import { createHash, randomUUID } from "node:crypto";
import { Types, type Model } from "mongoose";
import { LeadModel, UserModel } from "@/models";
import { ApiError } from "@/lib/api/responses";
import { assertRoleAccess } from "@/lib/auth/permissions";
import type { LeadActor } from "./access";
import { notifyLeadsRebalanced } from "@/lib/notifications/leads";
import { reassignOpenFollowUps } from "@/lib/notifications/follow-ups";

export const openLeadFilter = { status: { $nin: ["closed_won", "closed_lost", "invalid", "wrong_number", "not_interested"] } };
type Row = { id: string; ownerId: string | null; status: string; updatedAt: string };
type Member = { id: string; fullName: string };
// Plain persisted fields for bulk updates (the inferred schema uses hydrated subdocuments).
type AssignmentLead = {
  ownerId: Types.ObjectId | null; status: string; updatedAt: Date;
  assignmentHistory: Array<{ from: Types.ObjectId | null; to: Types.ObjectId; actorId: Types.ObjectId; method: string; at: Date }>;
};

// Keep as many existing assignments as possible, then fill each member's deficit.
export function planLeadRebalance(leads: Row[], team: Member[]) {
  const quotas = team.map((member, index) => ({ ...member, before: leads.filter((lead) => lead.ownerId === member.id).length,
    after: Math.floor(leads.length / team.length) + (index < leads.length % team.length ? 1 : 0), kept: 0 }));
  const pool: Row[] = [];
  for (const lead of leads) {
    const member = quotas.find((member) => member.id === lead.ownerId);
    if (member && member.kept < member.after) member.kept++;
    else pool.push(lead);
  }
  const moves: Array<{ lead: Row; to: string }> = [];
  let index = 0;
  for (const member of quotas) {
    for (let n = member.kept; n < member.after; n++) moves.push({ lead: pool[index++], to: member.id });
  }
  return { total: leads.length, moves, team: quotas.map(({ id, fullName, before, after }) => ({ id, fullName, before, after })) };
}

export async function getLeadRebalancePlan(actor: LeadActor) {
  assertRoleAccess(actor.role, { oneOf: ["admin"] });
  const users = await UserModel.find({ role: "sales", status: "active" }).sort({ _id: 1 }).select("fullName").lean();
  const docs = await LeadModel.find(openLeadFilter).sort({ createdAt: 1, _id: 1 }).select("ownerId status updatedAt").lean();
  const team = users.map((user): Member => ({ id: String(user._id), fullName: user.fullName }));
  const leads = docs.map((lead): Row => ({ id: String(lead._id), ownerId: lead.ownerId ? String(lead.ownerId) : null, status: lead.status, updatedAt: lead.updatedAt?.toISOString() ?? "" }));
  const plan = planLeadRebalance(leads, team);
  return { ...plan, token: createHash("sha256").update(JSON.stringify({ leads, team })).digest("hex") };
}

export async function rebalanceLeads(actor: LeadActor, token: string) {
  assertRoleAccess(actor.role, { oneOf: ["admin"] });
  const db = LeadModel.db.db!;
  const locks = db.collection<{ _id: string; token: string; expiresAt: Date }>("lead_rebalance_locks");
  const lockToken = randomUUID();
  // An expired lease is recoverable after a crashed worker. Never remove another worker's lease.
  await locks.deleteOne({ _id: "sales", expiresAt: { $lt: new Date() } });
  try { await locks.insertOne({ _id: "sales", token: lockToken, expiresAt: new Date(Date.now() + 600_000) }); }
  catch (error) { if ((error as { code?: number }).code === 11000) throw new ApiError("A rebalance is already running", 409); throw error; }
  try {
    const plan = await getLeadRebalancePlan(actor);
    if (plan.token !== token) throw new ApiError("Leads or sales team changed. Preview again before rebalancing.", 409);
    if (!plan.team.length) throw new ApiError("No active salespeople available", 422);
    if (!plan.moves.length) return { total: plan.total, moved: 0, skipped: 0 };
    const at = new Date();
    const result = await (LeadModel as Model<AssignmentLead>).bulkWrite(plan.moves.map(({ lead, to }) => ({ updateOne: {
      filter: { _id: lead.id, ownerId: lead.ownerId, status: lead.status, updatedAt: lead.updatedAt ? new Date(lead.updatedAt) : { $exists: false } },
      update: { $set: { ownerId: new Types.ObjectId(to) }, $push: { assignmentHistory: { from: lead.ownerId ? new Types.ObjectId(lead.ownerId) : null, to: new Types.ObjectId(to), actorId: new Types.ObjectId(actor.userId), method: "rebalance", at } } },
    } })));
    // Each moved lead takes its open follow-ups with it, for the same reason a
    // single transfer does.
    await Promise.all(
      plan.moves.map(({ lead, to }) => reassignOpenFollowUps(lead.id, to)),
    );

    // One summary per affected salesperson. A rebalance can move dozens of leads
    // at once, and a notification per lead would be unusable.
    if (result.modifiedCount > 0) {
      const movesByOwner = new Map<string, { count: number; sampleLeadId: string }>();
      for (const { lead, to } of plan.moves) {
        const existing = movesByOwner.get(to);
        if (existing) existing.count += 1;
        else movesByOwner.set(to, { count: 1, sampleLeadId: lead.id });
      }
      void notifyLeadsRebalanced({ movesByOwner, actorId: actor.userId, at })
        .catch((error) => console.error("rebalance notify failed:", error));
    }

    return { total: plan.total, moved: result.modifiedCount, skipped: plan.moves.length - result.modifiedCount };
  } finally { await locks.deleteOne({ _id: "sales", token: lockToken }); }
}

import { leadVisibilityFilter } from "@/lib/leads/access";
import { connectToDatabase } from "@/lib/db/mongodb";
import { LeadModel } from "@/models";
import { createLeadSchema } from "@/lib/validation/lead";
import { scoreLead } from "@/lib/leads/scoring";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";
import { logActivity } from "@/lib/activity/logging";
import { notifyLeadCreated } from "@/lib/notifications/leads";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priorityBand = searchParams.get("priorityBand");
    const category = searchParams.get("category");
    const requestedLimit = Number(searchParams.get("limit") ?? 300);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 500)
      : 300;

    const query: Record<string, unknown> = { ...leadVisibilityFilter(actor) };
    if (status) query.status = status;
    if (priorityBand) query.priorityBand = priorityBand;
    if (category) query.category = category;

    const leads = await LeadModel.find(query).sort({ updatedAt: -1 }).limit(limit).lean();
    return ok(serializeForJson(leads));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const payload = createLeadSchema.parse(await request.json());
    const scoring = scoreLead({
      source: payload.source,
      category: payload.category,
      urgency: payload.urgency,
      budget: payload.budget,
    });

    const lead = await LeadModel.create({
      ...payload,
      ...scoring,
    });

    // Round-robin assignment happens in the Lead pre-save hook, so the owner is
    // only known once the document exists. Best-effort: the lead is already saved.
    void notifyLeadCreated({
      leadId: String(lead._id),
      leadTitle: lead.title ?? "Lead",
      ownerId: lead.ownerId ? String(lead.ownerId) : null,
      actorId: actor.userId,
      source: lead.source ?? null,
      notifyAdmins: false,
    }).catch((error) => console.error("lead created notify failed:", error));

    await logActivity({
      action: "lead_status_changed",
      actorId: actor.userId,
      entityType: "lead",
      entityId: String(lead._id),
      details: {
        from: null,
        to: lead.status,
        score: lead.score,
        priorityBand: lead.priorityBand,
      },
    });

    return ok(serializeForJson(lead), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

import { assertSalesLeadAccess } from "@/lib/leads/access";
import { LeadModel, UserModel } from "@/models";
import { ApiError } from "@/lib/api/responses";
import { assertRoleAccess } from "@/lib/auth/permissions";
import { notifyLeadAssigned } from "@/lib/notifications/leads";
import { reassignOpenFollowUps } from "@/lib/notifications/follow-ups";
import type { UserRole } from "@/types/user";

export async function changeLeadOwner(id: string, payload: { ownerId: string; expectedOwnerId: string | null }, actor: { userId: string; role: UserRole }) {
    assertRoleAccess(actor.role, { oneOf: ["admin", "sales"] });
    await assertSalesLeadAccess(actor, id);
    if (actor.role === "sales" && payload.expectedOwnerId !== actor.userId) throw new ApiError("Assignment changed. Refresh and try again.", 409);
    const recipient = await UserModel.exists({ _id: payload.ownerId, role: "sales", status: "active" });
    if (!recipient) throw new ApiError("Choose an active salesperson", 422);
    if (payload.ownerId === payload.expectedOwnerId) throw new ApiError("Lead is already assigned to this salesperson", 422);
    const lead = await LeadModel.findOneAndUpdate(
      { _id: id, ownerId: actor.role === "sales" ? actor.userId : payload.expectedOwnerId },
      { $set: { ownerId: payload.ownerId }, $push: { assignmentHistory: {
        from: payload.expectedOwnerId, to: payload.ownerId, actorId: actor.userId,
        method: actor.role === "admin" ? "manual" : "transfer", at: new Date(),
      } } },
      { returnDocument: "after", runValidators: true },
    ).select("ownerId title");
    if (!lead) {
      if (!await LeadModel.exists({ _id: id })) throw new ApiError("Lead not found", 404);
      throw new ApiError("Assignment changed. Refresh and try again.", 409);
    }

    // Open follow-ups belong to whoever owns the lead now. Left behind, they
    // would sit with a rep who can no longer open the lead at all.
    await reassignOpenFollowUps(id, payload.ownerId);

    // Best-effort: the reassignment has already happened and must stand whether
    // or not anyone can be told about it.
    void notifyLeadAssigned({
      leadId: id,
      leadTitle: lead.title ?? "Lead",
      newOwnerId: payload.ownerId,
      previousOwnerId: payload.expectedOwnerId,
      actorId: actor.userId,
      byAdmin: actor.role === "admin",
    }).catch((error) => console.error("lead assignment notify failed:", error));

    return lead;
}

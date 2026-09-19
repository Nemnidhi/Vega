import { LeadModel } from "@/models/Lead";
import { UserModel } from "@/models/User";
import { assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { assertSalesLeadAccess, type LeadActor } from "./access";
import { updateLeadStatusSchema } from "@/lib/validation/lead";
import { objectIdSchema } from "@/lib/validation/common";
import { ApiError } from "@/lib/api/responses";

export async function changeLeadStatus(actor: LeadActor, id: string, input: unknown) {
  assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });
  objectIdSchema.parse(id);
  const payload = updateLeadStatusSchema.parse(input);
  await assertSalesLeadAccess(actor, id);
  const lead = await LeadModel.findById(id).lean();
  if (!lead) throw new ApiError("Lead not found", 404);
  const previousStatus = lead.status;
  const set: Record<string, unknown> = { status: payload.status };
  if (payload.status === "closed_won") {
    if (lead.status === "closed_won" && lead.closure?.closedAt) return { lead, previousStatus };
    if (payload.revenue === undefined) throw new ApiError("Enter revenue in INR to close this deal", 422);
    if (!lead.ownerId || !await UserModel.exists({ _id: lead.ownerId, role: "sales" })) throw new ApiError("Assign this lead to a salesperson before closing it", 422);
    // One atomic lead write stores the closure and status. Target progress is derived
    // from this record, so retries cannot increment targets twice.
    set.closure = {
      revenuePaise: Math.round(payload.revenue * 100), salespersonId: lead.ownerId,
      closedAt: new Date(), recordedBy: actor.userId,
    };
  }
  const updated = await LeadModel.findOneAndUpdate(
    { _id: id, ownerId: lead.ownerId ?? null, status: lead.status, updatedAt: lead.updatedAt },
    { $set: set }, { returnDocument: "after", runValidators: true },
  );
  if (!updated) throw new ApiError("Lead changed. Refresh and try again.", 409);
  return { lead: updated, previousStatus };
}

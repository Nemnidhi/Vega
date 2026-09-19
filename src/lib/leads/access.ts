import { Types } from "mongoose";
import { LeadModel } from "@/models/Lead";
import { ApiError } from "@/lib/api/responses";
import type { UserRole } from "@/types/user";

export type LeadActor = { userId: string; role: UserRole };

export function leadVisibilityFilter(actor: LeadActor) {
  return actor.role === "sales" ? { ownerId: new Types.ObjectId(actor.userId) } : {};
}

export async function assertSalesLeadAccess(actor: LeadActor, leadId: string) {
  if (actor.role !== "sales") return;
  if (!Types.ObjectId.isValid(leadId) || !await LeadModel.exists({ _id: leadId, ...leadVisibilityFilter(actor) })) {
    throw new ApiError("Lead not found", 404);
  }
}

export async function relatedLeadFilter(actor: LeadActor) {
  if (actor.role !== "sales") return {};
  return { leadId: { $in: await LeadModel.find(leadVisibilityFilter(actor)).distinct("_id") } };
}

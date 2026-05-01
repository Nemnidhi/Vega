import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { createChangeOrderSchema } from "@/lib/validation/change-order";
import { ChangeOrderModel, LeadModel } from "@/models";
import { detectOutOfScopeFeature } from "@/lib/workflows/change-order";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.createChangeOrders });

    const changeOrders = await ChangeOrderModel.find({})
      .sort({ updatedAt: -1 })
      .populate("leadId", "title status")
      .populate("clientId", "legalName")
      .lean();

    return ok(serializeForJson(changeOrders));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.createChangeOrders });

    const payload = createChangeOrderSchema.parse(await request.json());
    const lead = await LeadModel.findById(payload.leadId).lean();
    if (!lead) {
      throw new Error("Lead not found");
    }
    if (lead.status !== "closed_won") {
      throw new Error("Change Order can be created only after lead is Closed Won");
    }

    const scopeCheck = await detectOutOfScopeFeature(payload.leadId, payload.requestedFeature);
    if (!scopeCheck.outOfScope) {
      throw new Error("Requested feature is in-scope. Change Order is not required.");
    }

    const changeOrder = await ChangeOrderModel.create(payload);

    await logActivity({
      action: "change_order_created",
      actorId: actor.userId,
      entityType: "change_order",
      entityId: String(changeOrder._id),
      details: {
        leadId: payload.leadId,
        reasonOutOfScope: payload.reasonOutOfScope,
        systemReason: scopeCheck.reason,
      },
    });

    return ok(serializeForJson(changeOrder), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

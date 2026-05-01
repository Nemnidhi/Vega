import { connectToDatabase } from "@/lib/db/mongodb";
import { LeadModel } from "@/models";
import { updateLeadStatusSchema } from "@/lib/validation/lead";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { assertLeadCanBeClosedWon } from "@/lib/workflows/lead-guards";
import { handleApiError, ok } from "@/lib/api/responses";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const { status } = updateLeadStatusSchema.parse(await request.json());
    const { id } = await params;

    const lead = await LeadModel.findById(id);
    if (!lead) {
      throw new Error("Lead not found");
    }

    if (status === "closed_won") {
      await assertLeadCanBeClosedWon(id);
    }

    const previousStatus = lead.status;
    lead.status = status;
    await lead.save();

    await logActivity({
      action: "lead_status_changed",
      actorId: actor.userId,
      entityType: "lead",
      entityId: String(lead._id),
      details: { from: previousStatus, to: status },
    });

    return ok(serializeForJson(lead));
  } catch (error) {
    return handleApiError(error);
  }
}

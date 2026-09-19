import { changeLeadStatus } from "@/lib/leads/close-deal";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const { id } = await params;
    const { lead, previousStatus } = await changeLeadStatus(actor, id, await request.json());
    const status = lead.status;

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

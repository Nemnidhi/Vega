import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { logActivity } from "@/lib/activity/logging";
import { updateLeadFollowUpSchema } from "@/lib/validation/lead-follow-up";
import { LeadFollowUpModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const { id } = await params;
    const payload = updateLeadFollowUpSchema.parse(await request.json());
    const followUp = await LeadFollowUpModel.findById(id);
    if (!followUp) throw new Error("Follow-up not found");

    const previousStatus = followUp.status;
    Object.assign(followUp, payload);

    if (payload.status === "completed" && !followUp.completedAt) {
      followUp.completedAt = new Date();
    }
    if (payload.status && payload.status !== "completed") {
      followUp.completedAt = null;
    }

    await followUp.save();

    await logActivity({
      action:
        payload.status === "completed"
          ? "lead_follow_up_completed"
          : "lead_follow_up_updated",
      actorId: actor.userId,
      entityType: "lead",
      entityId: String(followUp.leadId),
      details: {
        followUpId: String(followUp._id),
        from: previousStatus,
        to: followUp.status,
        dueAt: followUp.dueAt,
        outcome: followUp.outcome,
      },
    });

    await followUp.populate("leadId", "title contactName email phone status");
    await followUp.populate("assignedToUserId", "fullName email role");
    await followUp.populate("createdById", "fullName email role");

    return ok(serializeForJson(followUp));
  } catch (error) {
    return handleApiError(error);
  }
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { logActivity } from "@/lib/activity/logging";
import { createLeadFollowUpSchema } from "@/lib/validation/lead-follow-up";
import { LeadFollowUpModel, LeadModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const { id } = await params;
    const lead = await LeadModel.findById(id).select("_id").lean();
    if (!lead) throw new Error("Lead not found");

    const followUps = await LeadFollowUpModel.find({ leadId: id })
      .sort({ status: 1, dueAt: 1 })
      .limit(100)
      .populate("assignedToUserId", "fullName email role")
      .populate("createdById", "fullName email role")
      .lean();

    return ok(serializeForJson(followUps));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const { id } = await params;
    const lead = await LeadModel.findById(id).select("_id title").lean();
    if (!lead) throw new Error("Lead not found");

    const payload = createLeadFollowUpSchema.parse(await request.json());
    const followUp = await LeadFollowUpModel.create({
      ...payload,
      assignedToUserId: payload.assignedToUserId ?? actor.userId,
      leadId: id,
      createdById: actor.userId,
    });

    await logActivity({
      action: "lead_follow_up_created",
      actorId: actor.userId,
      entityType: "lead",
      entityId: String(lead._id),
      details: {
        followUpId: String(followUp._id),
        dueAt: followUp.dueAt,
        channel: followUp.channel,
        priority: followUp.priority,
        nextAction: followUp.nextAction,
      },
    });

    await followUp.populate("assignedToUserId", "fullName email role");
    await followUp.populate("createdById", "fullName email role");

    return ok(serializeForJson(followUp), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { objectIdSchema } from "@/lib/validation/common";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { logActivity } from "@/lib/activity/logging";
import { MeetingModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { z } from "zod";

const patchMeetingSchema = z.object({
  action: z.enum(["assign", "cancel"]),
  cancelledReason: z.string().trim().max(500).optional(),
});

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    if (actor.role === "client") {
      throw new Error("Forbidden");
    }

    const { id } = await params;
    const meetingId = objectIdSchema.parse(id);
    const payload = patchMeetingSchema.parse(await request.json());

    const meeting = await MeetingModel.findById(meetingId);
    if (!meeting) {
      return fail("Meeting not found.", 404);
    }

    if (payload.action === "assign") {
      // Any staff role can self-assign - only cancelling needs the higher manageMeetings bar.
      meeting.assignedToUserId = actor.userId as unknown as typeof meeting.assignedToUserId;
      await meeting.save();
      await logActivity({
        action: "meeting_assigned",
        actorId: actor.userId,
        entityType: "meeting",
        entityId: String(meeting._id),
        details: { assignedToUserId: actor.userId },
      });
    } else {
      assertRoleAccess(actor.role, { oneOf: permissionRules.manageMeetings });
      meeting.status = "cancelled";
      meeting.cancelledAt = new Date();
      meeting.cancelledReason = payload.cancelledReason ?? "";
      await meeting.save();
      await logActivity({
        action: "meeting_cancelled",
        actorId: actor.userId,
        entityType: "meeting",
        entityId: String(meeting._id),
        details: { reason: payload.cancelledReason },
      });
    }

    const hydrated = await MeetingModel.findById(meeting._id)
      .populate("clientUserId", "fullName email")
      .populate("assignedToUserId", "fullName")
      .lean();

    return ok(serializeForJson(hydrated));
  } catch (error) {
    return handleApiError(error);
  }
}

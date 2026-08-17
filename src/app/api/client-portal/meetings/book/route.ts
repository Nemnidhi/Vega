import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret, resolveClientPortalActor } from "@/lib/auth/client-portal-actor";
import { resolveClientLeadId } from "@/lib/auth/client-lead";
import { bookMeetingSchema } from "@/lib/validation/meeting-availability";
import { MeetingAvailabilityModel, MeetingModel, UserModel } from "@/models";
import { computeOpenSlots, type AvailabilityConfig } from "@/lib/meetings/slots";
import { istWallTimeToUtc } from "@/lib/meetings/date";
import { sendMeetingConfirmationEmail } from "@/lib/notifications/send-meeting-confirmation-email";
import { logActivity } from "@/lib/activity/logging";
import { ApiError, handleApiError, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";

// The Indore office address (also shown on the website's Contact section) - reused verbatim
// so the two never drift apart in wording.
const OFFICE_LOCATION = "B20 - 5th Floor, Gravity Mall, Mechanic Nagar, Indore";
const ONLINE_LOCATION = "Meeting link will be shared with you before the call.";

export async function POST(request: Request) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();

    const payload = bookMeetingSchema.parse(await request.json());
    const actor = await resolveClientPortalActor(payload.clientUserId);

    const user = await UserModel.findById(actor.userId).lean();
    if (!user) {
      throw new ApiError("Account not found.", 404);
    }

    const leadId = payload.leadId ?? (await resolveClientLeadId(actor));

    const availabilityDoc = await MeetingAvailabilityModel.findOne().lean();
    if (!availabilityDoc) {
      throw new ApiError("Meeting booking isn't configured yet - please contact us directly.", 409);
    }

    const availability: AvailabilityConfig = {
      weeklyWindows: availabilityDoc.weeklyWindows ?? [],
      slotDurationMinutes: availabilityDoc.slotDurationMinutes,
      bufferMinutes: availabilityDoc.bufferMinutes,
      maxConcurrentBookings: availabilityDoc.maxConcurrentBookings,
      bookingWindowDays: availabilityDoc.bookingWindowDays,
      minNoticeHours: availabilityDoc.minNoticeHours,
      blackoutDates: availabilityDoc.blackoutDates ?? [],
    };

    const startAtUtc = istWallTimeToUtc(payload.dateKey, payload.timeKey);
    const now = new Date();

    // Re-validate against fresh data (never trust a slot the client saw on an earlier page
    // load) - re-run the same generator, scoped to just this one date.
    const existingMeetingsForDay = await MeetingModel.find({
      type: payload.type,
      status: "confirmed",
      startAt: {
        $gte: istWallTimeToUtc(payload.dateKey, "00:00"),
        $lt: istWallTimeToUtc(payload.dateKey, "23:59"),
      },
    })
      .select("startAt")
      .lean();

    const candidateSlots = computeOpenSlots({
      availability,
      type: payload.type,
      existingMeetings: existingMeetingsForDay,
      now,
      days: availability.bookingWindowDays,
    });
    const stillOpen = candidateSlots.some(
      (s) => s.dateKey === payload.dateKey && s.timeKey === payload.timeKey,
    );
    if (!stillOpen) {
      throw new ApiError("That slot is no longer available - please pick another.", 409);
    }

    // Race-condition recheck, immediately before insert: closes the gap between the check
    // above and the write below. Not wrapped in a transaction (no mongoose.startSession usage
    // exists anywhere in this codebase, and the deployment's replica-set topology isn't
    // confirmed) - acceptable for a low-volume, human-paced booking flow with capacity
    // typically 1; revisit with a real transaction if this ever actually collides.
    const concurrentCount = await MeetingModel.countDocuments({
      startAt: startAtUtc,
      type: payload.type,
      status: "confirmed",
    });
    const capacity = availability.maxConcurrentBookings[payload.type];
    if (concurrentCount >= capacity) {
      throw new ApiError("That slot was just taken - please pick another.", 409);
    }

    const location = payload.type === "in_person" ? OFFICE_LOCATION : ONLINE_LOCATION;

    const meeting = await MeetingModel.create({
      type: payload.type,
      startAt: startAtUtc,
      durationMinutes: availability.slotDurationMinutes,
      clientUserId: actor.userId,
      leadId: leadId ?? null,
      contactName: user.fullName,
      contactEmail: user.email,
      contactPhone: user.phone,
      notes: payload.notes ?? "",
      status: "confirmed",
      assignedToUserId: null,
      location,
    });

    await logActivity({
      action: "meeting_booked",
      actorId: actor.userId,
      entityType: "meeting",
      entityId: String(meeting._id),
      details: { type: payload.type, startAt: startAtUtc.toISOString() },
    });

    const emailResult = await sendMeetingConfirmationEmail({
      to: user.email,
      contactName: user.fullName,
      type: payload.type,
      startAt: startAtUtc,
      durationMinutes: availability.slotDurationMinutes,
      location,
    });

    return ok(
      { meeting: serializeForJson(meeting.toObject()), emailSent: emailResult.sent },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidDashboardSecret } from "@/lib/auth/dashboard-actor";
import { dashboardBookMeetingSchema } from "@/lib/validation/integrations";
import { MeetingAvailabilityModel, MeetingModel } from "@/models";
import { computeOpenSlots, type AvailabilityConfig } from "@/lib/meetings/slots";
import { istWallTimeToUtc } from "@/lib/meetings/date";
import { sendMeetingConfirmationEmail } from "@/lib/notifications/send-meeting-confirmation-email";
import { logActivity } from "@/lib/activity/logging";
import { ApiError, handleApiError, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";

// Lead-based twin of client-portal/meetings/book - same slot-revalidation and race-recheck
// logic, but keyed by contactPhone/leadId instead of an authenticated clientUserId, since a
// fresh WhatsApp qualifying-flow lead has no portal account. See the comment on
// Meeting.clientUserId for why the field is nullable now.
const OFFICE_LOCATION = "B20 - 5th Floor, Gravity Mall, Mechanic Nagar, Indore";
const ONLINE_LOCATION = "Meeting link will be shared with you before the call.";

export async function POST(request: Request) {
  try {
    assertValidDashboardSecret(request);
    await connectToDatabase();

    const payload = dashboardBookMeetingSchema.parse(await request.json());

    const availabilityDoc = await MeetingAvailabilityModel.findOne().lean();
    if (!availabilityDoc) {
      throw new ApiError("Meeting booking isn't configured yet.", 409);
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

    // Re-validate against fresh data - never trust a slot Dashboard saw when it fetched the
    // list, the reply may have arrived minutes (or a resumed run, hours) later.
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
      throw new ApiError("That slot is no longer available.", 409);
    }

    const concurrentCount = await MeetingModel.countDocuments({
      startAt: startAtUtc,
      type: payload.type,
      status: "confirmed",
    });
    const capacity = availability.maxConcurrentBookings[payload.type];
    if (concurrentCount >= capacity) {
      throw new ApiError("That slot was just taken.", 409);
    }

    const location = payload.type === "in_person" ? OFFICE_LOCATION : ONLINE_LOCATION;

    const meeting = await MeetingModel.create({
      type: payload.type,
      startAt: startAtUtc,
      durationMinutes: availability.slotDurationMinutes,
      clientUserId: null,
      leadId: payload.leadId ?? null,
      contactName: payload.contactName,
      contactEmail: payload.contactEmail ?? "",
      contactPhone: payload.contactPhone,
      notes: payload.notes ?? "",
      status: "confirmed",
      assignedToUserId: null,
      location,
    });

    await logActivity({
      action: "meeting_booked",
      entityType: "meeting",
      entityId: String(meeting._id),
      details: { type: payload.type, startAt: startAtUtc.toISOString(), source: "dashboard_whatsapp" },
    });

    const emailResult = payload.contactEmail
      ? await sendMeetingConfirmationEmail({
          to: payload.contactEmail,
          contactName: payload.contactName,
          type: payload.type,
          startAt: startAtUtc,
          durationMinutes: availability.slotDurationMinutes,
          location,
        })
      : { sent: false as const, reason: "no_email" as const };

    return ok(
      {
        meeting: serializeForJson(meeting.toObject()),
        emailSent: emailResult.sent,
        durationMinutes: availability.slotDurationMinutes,
        location,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

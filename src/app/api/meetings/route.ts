import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { ApiError, handleApiError, ok } from "@/lib/api/responses";
import { staffCreateMeetingSchema } from "@/lib/validation/meeting-availability";
import { MeetingAvailabilityModel, MeetingModel } from "@/models";
import { computeOpenSlots, type AvailabilityConfig } from "@/lib/meetings/slots";
import { istWallTimeToUtc } from "@/lib/meetings/date";
import { sendMeetingConfirmationEmail } from "@/lib/notifications/send-meeting-confirmation-email";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

// Same office address / online placeholder used by every other booking route (client-portal,
// the Dashboard-WhatsApp integration) - kept identical so a meeting's location text never
// differs by which path created it.
const OFFICE_LOCATION = "B20 - 5th Floor, Gravity Mall, Mechanic Nagar, Indore";
const ONLINE_LOCATION = "Meeting link will be shared with you before the call.";

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    if (actor.role === "client") {
      throw new Error("Forbidden");
    }

    const meetings = await MeetingModel.find({ status: "confirmed" })
      .sort({ startAt: 1 })
      .limit(500)
      .populate("clientUserId", "fullName email")
      .populate("assignedToUserId", "fullName")
      .lean();

    return ok(serializeForJson(meetings));
  } catch (error) {
    return handleApiError(error);
  }
}

// Staff-initiated creation - until now the only way a Meeting document could ever be created was
// a client (or a WhatsApp lead, via the Dashboard integration) self-booking; there was no route
// at all for a staff member to schedule one directly (e.g. a call agreed over the phone). Mirrors
// integrations/meetings/book's slot-revalidation and race-recheck logic exactly, just gated by
// the dashboard session/role instead of the integration's shared secret.
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageMeetings });

    const payload = staffCreateMeetingSchema.parse(await request.json());

    const availabilityDoc = await MeetingAvailabilityModel.findOne().lean();
    if (!availabilityDoc) {
      throw new ApiError("Meeting booking isn't configured yet - set availability first.", 409);
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

    // Re-validate against fresh data, same reasoning as every other booking route - never trust
    // a slot the staff member's browser fetched on an earlier page load.
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

    // Assigned to the creating staff member immediately, unlike a self-booked meeting (which
    // starts unassigned for anyone to pick up) - the person scheduling it is, by definition,
    // already the one handling it.
    const meeting = await MeetingModel.create({
      type: payload.type,
      startAt: startAtUtc,
      durationMinutes: availability.slotDurationMinutes,
      clientUserId: null,
      leadId: payload.leadId ?? null,
      contactName: payload.contactName,
      contactEmail: payload.contactEmail ?? "",
      contactPhone: payload.contactPhone ?? "",
      notes: payload.notes ?? "",
      status: "confirmed",
      assignedToUserId: actor.userId,
      location,
    });

    await logActivity({
      action: "meeting_booked",
      actorId: actor.userId,
      entityType: "meeting",
      entityId: String(meeting._id),
      details: { type: payload.type, startAt: startAtUtc.toISOString(), source: "staff_dashboard" },
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

    const populated = await MeetingModel.findById(meeting._id)
      .populate("clientUserId", "fullName email")
      .populate("assignedToUserId", "fullName")
      .lean();

    return ok(
      { meeting: serializeForJson(populated), emailSent: emailResult.sent },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

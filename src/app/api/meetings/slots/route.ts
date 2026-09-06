import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { MeetingAvailabilityModel, MeetingModel } from "@/models";
import { computeOpenSlots, type AvailabilityConfig, type MeetingType } from "@/lib/meetings/slots";
import { addDaysToDateKey, getMeetingDateKey, istWallTimeToUtc } from "@/lib/meetings/date";
import { handleApiError, ok } from "@/lib/api/responses";

// Session-authenticated twin of client-portal/meetings/availability's slot computation - that
// route is gated by the client-portal shared secret, unusable from an authenticated staff
// session in the dashboard itself. Backs the new staff "create meeting" form (meetings-view.tsx)
// so it offers the same real, capacity-checked slots a client would see, rather than letting
// staff pick an arbitrary time that POST /api/meetings would just reject.
export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageMeetings });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    if (type !== "online" && type !== "in_person") {
      throw new Error("type must be 'online' or 'in_person'");
    }

    const availabilityDoc = await MeetingAvailabilityModel.findOne().lean();
    if (!availabilityDoc) {
      // No config yet - a sane empty state, not an error.
      return ok({ slots: [] });
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

    const now = new Date();
    const windowEndDateKey = addDaysToDateKey(getMeetingDateKey(now), availability.bookingWindowDays);
    const windowEnd = istWallTimeToUtc(windowEndDateKey, "23:59");

    const existingMeetings = await MeetingModel.find({
      type: type as MeetingType,
      status: "confirmed",
      startAt: { $gte: now, $lte: windowEnd },
    })
      .select("startAt")
      .lean();

    const slots = computeOpenSlots({
      availability,
      type: type as MeetingType,
      existingMeetings,
      now,
    });

    return ok({ slots });
  } catch (error) {
    return handleApiError(error);
  }
}

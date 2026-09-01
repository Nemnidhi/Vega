import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidDashboardSecret } from "@/lib/auth/dashboard-actor";
import { MeetingAvailabilityModel, MeetingModel } from "@/models";
import { computeOpenSlots, type AvailabilityConfig, type MeetingType } from "@/lib/meetings/slots";
import { addDaysToDateKey, getMeetingDateKey, istWallTimeToUtc } from "@/lib/meetings/date";
import { fail, handleApiError, ok } from "@/lib/api/responses";

// Server-to-server twin of client-portal/meetings/availability - same computeOpenSlots engine,
// just authenticated for Dashboard-WhatsApp instead of the website's client-portal session
// forwarding, and with no clientUserId in scope (a WhatsApp lead isn't a portal client).
export async function GET(request: Request) {
  try {
    assertValidDashboardSecret(request);
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "online";
    if (type !== "online" && type !== "in_person") {
      return fail("type must be 'online' or 'in_person'", 400);
    }
    const daysParam = searchParams.get("days");
    const days = daysParam ? Number(daysParam) : undefined;

    const availabilityDoc = await MeetingAvailabilityModel.findOne().lean();
    if (!availabilityDoc) {
      // Not configured yet - a real, expected state until an admin sets one up at
      // vega.nemnidhi.com/meetings, not an error the caller should alarm on.
      return ok({ configured: false, slots: [] });
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
    const windowEndDateKey = addDaysToDateKey(
      getMeetingDateKey(now),
      Math.min(days ?? availability.bookingWindowDays, availability.bookingWindowDays),
    );
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
      days,
    });

    // WhatsApp's own list message caps at 10 rows - capping the wire payload here too, no point
    // shipping slots 40 days out that Dashboard's node would truncate anyway.
    return ok({
      configured: true,
      slots: slots.slice(0, 10).map((slot) => ({ dateKey: slot.dateKey, timeKey: slot.timeKey })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret } from "@/lib/auth/client-portal-actor";
import { MeetingAvailabilityModel, MeetingModel } from "@/models";
import { computeOpenSlots, type AvailabilityConfig, type MeetingType } from "@/lib/meetings/slots";
import { addDaysToDateKey, getMeetingDateKey, istWallTimeToUtc } from "@/lib/meetings/date";
import { handleApiError, ok } from "@/lib/api/responses";

export async function GET(request: Request) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    if (type !== "online" && type !== "in_person") {
      throw new Error("type must be 'online' or 'in_person'");
    }
    const daysParam = searchParams.get("days");
    const days = daysParam ? Number(daysParam) : undefined;

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

    return ok({ slots });
  } catch (error) {
    return handleApiError(error);
  }
}

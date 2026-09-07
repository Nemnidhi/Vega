import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidDashboardSecret } from "@/lib/auth/dashboard-actor";
import { MeetingAvailabilityModel } from "@/models";
import { dayOfWeekForDateKey, getMeetingDateKey, getMeetingTimeKey, timeKeyToMinutes } from "@/lib/meetings/date";
import type { WeeklyWindow } from "@/lib/meetings/slots";
import { handleApiError, ok } from "@/lib/api/responses";

// "Office hours" is deliberately not a second schedule - it reads the exact same
// MeetingAvailability.weeklyWindows an admin already configures at /meetings for booking slots,
// so Dashboard-WhatsApp's "are we open right now" branch and Vega's own slot generator can never
// drift apart into two different definitions of "open."
export async function GET(request: Request) {
  try {
    assertValidDashboardSecret(request);
    await connectToDatabase();

    const availabilityDoc = await MeetingAvailabilityModel.findOne().lean();
    if (!availabilityDoc) {
      return ok({ configured: false, open: false, weeklyWindows: [] });
    }

    const now = new Date();
    const todayKey = getMeetingDateKey(now);
    const isBlackout = (availabilityDoc.blackoutDates ?? []).includes(todayKey);
    const nowMinutes = timeKeyToMinutes(getMeetingTimeKey(now));
    const dow = dayOfWeekForDateKey(todayKey);

    const open =
      !isBlackout &&
      (availabilityDoc.weeklyWindows ?? []).some(
        (window: WeeklyWindow) =>
          window.dayOfWeek === dow &&
          nowMinutes >= timeKeyToMinutes(window.startTime) &&
          nowMinutes < timeKeyToMinutes(window.endTime),
      );

    return ok({ configured: true, open, weeklyWindows: availabilityDoc.weeklyWindows ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

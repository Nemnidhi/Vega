// Pure function, no DB/HTTP dependency - mirrors src/lib/blueprint/recommend.ts's precedent
// of keeping the actual computation injectable and independently testable.

import {
  addDaysToDateKey,
  dayOfWeekForDateKey,
  getMeetingDateKey,
  istWallTimeToUtc,
  minutesToTimeKey,
  timeKeyToMinutes,
} from "@/lib/meetings/date";

export type MeetingType = "online" | "in_person";

export type WeeklyWindow = { dayOfWeek: number; startTime: string; endTime: string };

export type AvailabilityConfig = {
  weeklyWindows: WeeklyWindow[];
  slotDurationMinutes: number;
  bufferMinutes: number;
  maxConcurrentBookings: { online: number; in_person: number };
  bookingWindowDays: number;
  minNoticeHours: number;
  blackoutDates: string[];
};

export type OpenSlot = { dateKey: string; timeKey: string; startAtUtc: Date; type: MeetingType };

export function computeOpenSlots(params: {
  availability: AvailabilityConfig;
  type: MeetingType;
  existingMeetings: Array<{ startAt: Date }>;
  now?: Date;
  days?: number;
}): OpenSlot[] {
  const { availability, type, existingMeetings, now = new Date() } = params;
  const days = Math.min(params.days ?? availability.bookingWindowDays, availability.bookingWindowDays);
  const capacity = availability.maxConcurrentBookings[type];
  const stepMinutes = availability.slotDurationMinutes + availability.bufferMinutes;
  const minNoticeMs = availability.minNoticeHours * 60 * 60 * 1000;
  const blackoutSet = new Set(availability.blackoutDates);

  const bookedCountByInstant = new Map<number, number>();
  for (const meeting of existingMeetings) {
    const key = meeting.startAt.getTime();
    bookedCountByInstant.set(key, (bookedCountByInstant.get(key) ?? 0) + 1);
  }

  const todayKey = getMeetingDateKey(now);
  const slots: OpenSlot[] = [];

  for (let d = 0; d <= days; d++) {
    const dateKey = addDaysToDateKey(todayKey, d);
    if (blackoutSet.has(dateKey)) continue;

    const dow = dayOfWeekForDateKey(dateKey);
    const windowsForDay = availability.weeklyWindows.filter((w) => w.dayOfWeek === dow);

    for (const window of windowsForDay) {
      const windowStart = timeKeyToMinutes(window.startTime);
      const windowEnd = timeKeyToMinutes(window.endTime);

      for (let t = windowStart; t + availability.slotDurationMinutes <= windowEnd; t += stepMinutes) {
        const timeKey = minutesToTimeKey(t);
        const startAtUtc = istWallTimeToUtc(dateKey, timeKey);

        if (startAtUtc.getTime() < now.getTime() + minNoticeMs) continue;
        if ((bookedCountByInstant.get(startAtUtc.getTime()) ?? 0) >= capacity) continue;

        slots.push({ dateKey, timeKey, startAtUtc, type });
      }
    }
  }

  return slots;
}

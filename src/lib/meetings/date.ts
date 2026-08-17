// Sibling to src/lib/attendance/date.ts's getAttendanceDateKey - same Intl.DateTimeFormat
// idiom, no new dependency. India observes no DST, so a fixed +5:30 offset is always safe.

export const MEETING_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MINUTES = 330;

function readPart(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

/** IST calendar-date key ("YYYY-MM-DD") for a given instant. */
export function getMeetingDateKey(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MEETING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return `${readPart(parts, "year")}-${readPart(parts, "month")}-${readPart(parts, "day")}`;
}

/** IST wall-clock "HH:MM" for a given instant. */
export function getMeetingTimeKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MEETING_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return `${readPart(parts, "hour")}:${readPart(parts, "minute")}`;
}

/**
 * dayOfWeek (0=Sun..6=Sat) of an IST calendar date, given only its "YYYY-MM-DD" key. Safe
 * because day-of-week is a property of the Y-M-D triad alone - interpreting the key as UTC
 * midnight (same trick src/lib/attendance/date.ts's parseDateKeyToUTC uses) doesn't shift
 * which calendar day it names.
 */
export function dayOfWeekForDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
}

/** The core conversion: an IST wall-clock day+time -> the real UTC instant. */
export function istWallTimeToUtc(dateKey: string, timeHHMM: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = timeHHMM.split(":").map(Number);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(naiveUtcMs - IST_OFFSET_MINUTES * 60 * 1000);
}

/** IST date key `days` calendar-days after `dateKey`. */
export function addDaysToDateKey(dateKey: string, days: number) {
  const base = new Date(`${dateKey}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return getMeetingDateKey(base);
}

/** Minutes since midnight, from an "HH:MM" string. */
export function timeKeyToMinutes(timeHHMM: string) {
  const [hour, minute] = timeHHMM.split(":").map(Number);
  return hour * 60 + minute;
}

export function minutesToTimeKey(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minute = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

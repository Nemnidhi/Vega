const ATTENDANCE_TIME_ZONE = "Asia/Kolkata";

function readDatePart(parts: Intl.DateTimeFormatPart[], type: "year" | "month" | "day") {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function getAttendanceDateKey(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ATTENDANCE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = readDatePart(parts, "year");
  const month = readDatePart(parts, "month");
  const day = readDatePart(parts, "day");
  return `${year}-${month}-${day}`;
}

export function getAttendanceMonthKey(date: Date = new Date()) {
  return getAttendanceDateKey(date).slice(0, 7);
}

// Minutes since midnight in Asia/Kolkata - used to compare a check-in timestamp against a
// configured "HH:mm" shift start without going through a Date object's own (server) timezone.
export function getAttendanceMinutesOfDay(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ATTENDANCE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  // hourCycle "h23" can still report "24" for midnight in some Intl implementations - normalize.
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function parseTimeOfDayToMinutes(timeOfDay: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeOfDay);
  if (!match) {
    throw new Error(`Invalid HH:mm time: ${timeOfDay}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function calculateMinutesBetween(startAt: Date, endAt: Date) {
  const minutes = Math.floor((endAt.getTime() - startAt.getTime()) / 60000);
  return Math.max(0, minutes);
}

export function calculateWorkedMinutes(
  checkInAt: Date,
  checkOutAt: Date,
  totalBreakMinutes = 0,
) {
  const grossMinutes = calculateMinutesBetween(checkInAt, checkOutAt);
  return Math.max(0, grossMinutes - Math.max(0, totalBreakMinutes));
}

function parseDateKeyToUTC(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

// A calendar date's weekday doesn't depend on timezone, so parsing at UTC midnight and reading
// getUTCDay() is safe and deterministic - unlike parsing at local midnight, which can shift the
// date across a boundary depending on the machine's own timezone.
export function isWeekendDateKey(dateKey: string) {
  const day = parseDateKeyToUTC(dateKey).getUTCDay();
  return day === 0 || day === 6;
}

// Every "YYYY-MM-DD" in a given "YYYY-MM" month, in order. Used by scripts that need to enumerate
// a month's calendar days server-side (the admin UI builds its own equivalent list client-side).
export function getDateKeysInMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${monthKey}-${day}`;
  });
}

export function calculateInclusiveDateSpanDays(startDateKey: string, endDateKey: string) {
  const start = parseDateKeyToUTC(startDateKey);
  const end = parseDateKeyToUTC(endDateKey);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay);
  return Math.max(0, diffDays) + 1;
}

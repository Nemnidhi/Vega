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

export function calculateInclusiveDateSpanDays(startDateKey: string, endDateKey: string) {
  const start = parseDateKeyToUTC(startDateKey);
  const end = parseDateKeyToUTC(endDateKey);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay);
  return Math.max(0, diffDays) + 1;
}

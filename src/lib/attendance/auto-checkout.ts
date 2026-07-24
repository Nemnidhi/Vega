import { AttendanceModel } from "@/models";
import { calculateWorkedMinutes } from "@/lib/attendance/date";

const AUTO_CHECKOUT_WORKED_MINUTES = 10 * 60;

type BreakSessionItem = {
  startAt?: Date | null;
  endAt?: Date | null;
  minutes?: number;
};

function calculateTotalBreakMinutes(breakSessions: BreakSessionItem[] = []) {
  return breakSessions.reduce((sum, item) => sum + (item.minutes ?? 0), 0);
}

function getAutoCheckoutAt(
  checkInAt: Date,
  breakSessions: BreakSessionItem[] = [],
  totalBreakMinutes = 0,
) {
  const activeBreak = breakSessions.find((item) => item.startAt && !item.endAt);
  const completedBreakMinutes = calculateTotalBreakMinutes(breakSessions);
  const breakMinutes = Math.max(totalBreakMinutes, completedBreakMinutes);
  const target = new Date(checkInAt.getTime() + (AUTO_CHECKOUT_WORKED_MINUTES + breakMinutes) * 60000);

  if (activeBreak?.startAt && target > activeBreak.startAt) {
    return null;
  }

  return target;
}

export async function autoCheckoutEligibleAttendance(userId?: string) {
  const query: Record<string, unknown> = {
    checkInAt: { $ne: null },
    checkOutAt: null,
  };

  if (userId) {
    query.userId = userId;
  }

  const entries = await AttendanceModel.find(query).select("checkInAt breakSessions totalBreakMinutes dayStatus");
  const now = new Date();

  for (const entry of entries) {
    if (!entry.checkInAt) {
      continue;
    }

    const breakSessions = (entry.breakSessions ?? []) as BreakSessionItem[];
    const checkOutAt = getAutoCheckoutAt(
      entry.checkInAt,
      breakSessions,
      entry.totalBreakMinutes ?? 0,
    );

    if (!checkOutAt || checkOutAt > now) {
      continue;
    }

    const totalBreakMinutes = calculateTotalBreakMinutes(breakSessions);
    entry.totalBreakMinutes = totalBreakMinutes;
    entry.checkOutAt = checkOutAt;
    entry.workedMinutes = calculateWorkedMinutes(entry.checkInAt, checkOutAt, totalBreakMinutes);
    entry.dayStatus = entry.dayStatus === "late_coming" ? "late_coming" : "present";
    await entry.save();
  }
}

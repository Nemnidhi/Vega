import { getAttendanceMonthKey } from "@/lib/attendance/date";
import { LeaveBalanceModel } from "@/models";

export const MONTHLY_LEAVE_ACCRUAL_DAYS = 2;

function toMonthIndex(monthKey: string) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  return year * 12 + (month - 1);
}

function calculateMonthDiff(fromMonthKey: string, toMonthKey: string) {
  const fromIndex = toMonthIndex(fromMonthKey);
  const toIndex = toMonthIndex(toMonthKey);
  return Math.max(0, toIndex - fromIndex);
}

export async function ensureLeaveBalanceForUser(userId: string) {
  const currentMonthKey = getAttendanceMonthKey();

  let balance = await LeaveBalanceModel.findOne({ userId });
  if (!balance) {
    balance = await LeaveBalanceModel.create({
      userId,
      availableDays: MONTHLY_LEAVE_ACCRUAL_DAYS,
      totalAccruedDays: MONTHLY_LEAVE_ACCRUAL_DAYS,
      totalUsedDays: 0,
      lastAccrualMonth: currentMonthKey,
    });
    return balance;
  }

  const monthsToCredit = calculateMonthDiff(balance.lastAccrualMonth, currentMonthKey);
  if (monthsToCredit > 0) {
    const creditDays = monthsToCredit * MONTHLY_LEAVE_ACCRUAL_DAYS;
    balance.availableDays += creditDays;
    balance.totalAccruedDays += creditDays;
    balance.lastAccrualMonth = currentMonthKey;
    await balance.save();
  }

  return balance;
}

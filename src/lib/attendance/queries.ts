import { connectToDatabase } from "@/lib/db/mongodb";
import { getAttendanceDateKey, getAttendanceMonthKey } from "@/lib/attendance/date";
import { attendanceMemberRoles } from "@/lib/attendance/constants";
import {
  ensureLeaveBalanceForUser,
  MONTHLY_LEAVE_ACCRUAL_DAYS,
} from "@/lib/attendance/leave-balance";
import { serializeForJson } from "@/lib/utils/serialize";
import { AttendanceModel, LeaveRequestModel, UserModel } from "@/models";

type AttendanceEntryForSummary = {
  dayStatus?: "present" | "absent" | "half_day";
  checkInAt?: Date | null;
  checkOutAt?: Date | null;
  workedMinutes?: number;
  totalBreakMinutes?: number;
};

type LeaveRequestEntryForSummary = {
  status?: "pending" | "approved" | "rejected" | "cancelled";
  totalDays?: number;
  startDateKey?: string;
};

export type BreakSessionRecord = {
  startAt?: string | null;
  endAt?: string | null;
  minutes?: number;
};

export type AttendanceRecord = {
  _id: string;
  dateKey: string;
  dayStatus?: "present" | "absent" | "half_day";
  checkInAt?: string | null;
  checkOutAt?: string | null;
  workedMinutes?: number;
  totalBreakMinutes?: number;
  breakSessions?: BreakSessionRecord[];
};

export type AttendanceDayStatus = "present" | "absent" | "half_day";

export type AttendanceCalendarDayRecord = {
  _id: string;
  dateKey: string;
  dayStatus: AttendanceDayStatus;
  checkInAt?: string | null;
  checkOutAt?: string | null;
};

export type AttendanceCalendarMonthPayload = {
  monthKey: string;
  summary: {
    presentDays: number;
    absentDays: number;
    halfDays: number;
    totalMarkedDays: number;
  };
  records: AttendanceCalendarDayRecord[];
};

export type AttendancePayload = {
  todayEntry: AttendanceRecord | null;
  recentEntries: AttendanceRecord[];
  monthSummary: {
    presentDays: number;
    halfDays: number;
    absentDays: number;
    completedDays: number;
    workedMinutes: number;
    breakMinutes: number;
  };
};

export type LeaveRequestRecord = {
  _id: string;
  leaveType: "casual" | "sick" | "planned" | "unpaid" | "other";
  startDateKey: string;
  endDateKey: string;
  totalDays: number;
  reason?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt?: string;
};

export type LeavePayload = {
  requests: LeaveRequestRecord[];
  monthSummary: {
    pendingCount: number;
    approvedDays: number;
    rejectedCount: number;
    cancelledCount: number;
  };
  balance: {
    availableDays: number;
    totalAccruedDays: number;
    totalUsedDays: number;
    pendingRequestedDays: number;
    lastAccrualMonth: string;
    monthlyAccrualDays: number;
  };
};

export type AdminLeaveRequestRecord = LeaveRequestRecord & {
  userId?: {
    _id: string;
    fullName: string;
    email: string;
    role: string;
  };
  reviewNote?: string;
};

export type AdminLeavePayload = {
  requests: AdminLeaveRequestRecord[];
  summary: {
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
  };
};

export type AttendanceStaffUser = {
  _id: string;
  fullName: string;
  email: string;
  role: "developer" | "sales";
  status: string;
};

export type AdminDailyAttendanceRecord = {
  _id: string;
  userId?: {
    _id: string;
    fullName: string;
    email: string;
    role: string;
  };
  dateKey: string;
  dayStatus: "present" | "absent" | "half_day";
  checkInAt?: string | null;
  checkOutAt?: string | null;
  workedMinutes?: number;
  totalBreakMinutes?: number;
  markedAt?: string | null;
};

export async function getAttendanceOverview(userId: string) {
  await connectToDatabase();

  const todayDateKey = getAttendanceDateKey();
  const monthDateKey = getAttendanceMonthKey();

  const [todayEntry, recentEntries, monthlyEntries] = await Promise.all([
    AttendanceModel.findOne({ userId, dateKey: todayDateKey }).lean(),
    AttendanceModel.find({ userId })
      .sort({ dateKey: -1 })
      .limit(21)
      .select("dateKey dayStatus checkInAt checkOutAt workedMinutes totalBreakMinutes breakSessions")
      .lean(),
    AttendanceModel.find({
      userId,
      dateKey: { $regex: `^${monthDateKey}` },
    })
      .select("dayStatus checkInAt checkOutAt workedMinutes totalBreakMinutes")
      .lean(),
  ]);

  const monthSummary = (monthlyEntries as AttendanceEntryForSummary[]).reduce<{
    presentDays: number;
    halfDays: number;
    absentDays: number;
    completedDays: number;
    workedMinutes: number;
    breakMinutes: number;
  }>(
    (summary, entry) => {
      if (entry.dayStatus === "present") {
        summary.presentDays += 1;
      }
      if (entry.dayStatus === "half_day") {
        summary.halfDays += 1;
      }
      if (entry.dayStatus === "absent") {
        summary.absentDays += 1;
      }
      if (entry.checkOutAt) {
        summary.completedDays += 1;
      }
      summary.workedMinutes += entry.workedMinutes ?? 0;
      summary.breakMinutes += entry.totalBreakMinutes ?? 0;
      return summary;
    },
    {
      presentDays: 0,
      halfDays: 0,
      absentDays: 0,
      completedDays: 0,
      workedMinutes: 0,
      breakMinutes: 0,
    },
  );

  return serializeForJson({
    todayEntry,
    recentEntries,
    monthSummary,
  }) as AttendancePayload;
}

type AttendanceCalendarSummarySource = {
  dayStatus?: AttendanceDayStatus;
};

export async function getAttendanceCalendarMonth(userId: string, monthKey: string) {
  await connectToDatabase();

  const records = await AttendanceModel.find({
    userId,
    dateKey: { $regex: `^${monthKey}` },
  })
    .sort({ dateKey: 1 })
    .select("dateKey dayStatus checkInAt checkOutAt")
    .lean();

  const summary = (records as AttendanceCalendarSummarySource[]).reduce(
    (acc, record) => {
      if (record.dayStatus === "present") {
        acc.presentDays += 1;
      } else if (record.dayStatus === "absent") {
        acc.absentDays += 1;
      } else if (record.dayStatus === "half_day") {
        acc.halfDays += 1;
      }

      return acc;
    },
    { presentDays: 0, absentDays: 0, halfDays: 0 },
  );

  return serializeForJson({
    monthKey,
    summary: {
      ...summary,
      totalMarkedDays: summary.presentDays + summary.absentDays + summary.halfDays,
    },
    records,
  }) as AttendanceCalendarMonthPayload;
}

export async function getLeaveRequestsForUser(userId: string) {
  await connectToDatabase();

  const monthDateKey = getAttendanceMonthKey();
  const leaveBalance = await ensureLeaveBalanceForUser(userId);
  const requests = await LeaveRequestModel.find({ userId })
    .sort({ createdAt: -1 })
    .limit(40)
    .select("leaveType startDateKey endDateKey totalDays reason status createdAt")
    .lean();

  const monthSummary = (requests as LeaveRequestEntryForSummary[]).reduce<{
    pendingCount: number;
    approvedDays: number;
    rejectedCount: number;
    cancelledCount: number;
  }>(
    (summary, entry) => {
      if (entry.status === "pending") {
        summary.pendingCount += 1;
      }
      if (entry.status === "rejected") {
        summary.rejectedCount += 1;
      }
      if (entry.status === "cancelled") {
        summary.cancelledCount += 1;
      }
      if (
        entry.status === "approved" &&
        typeof entry.startDateKey === "string" &&
        entry.startDateKey.startsWith(monthDateKey)
      ) {
        summary.approvedDays += entry.totalDays ?? 0;
      }
      return summary;
    },
    { pendingCount: 0, approvedDays: 0, rejectedCount: 0, cancelledCount: 0 },
  );

  const pendingRequestedDays = (requests as LeaveRequestEntryForSummary[]).reduce(
    (sum, entry) => sum + (entry.status === "pending" ? (entry.totalDays ?? 0) : 0),
    0,
  );

  return serializeForJson({
    requests,
    monthSummary,
    balance: {
      availableDays: leaveBalance.availableDays,
      totalAccruedDays: leaveBalance.totalAccruedDays,
      totalUsedDays: leaveBalance.totalUsedDays,
      pendingRequestedDays,
      lastAccrualMonth: leaveBalance.lastAccrualMonth,
      monthlyAccrualDays: MONTHLY_LEAVE_ACCRUAL_DAYS,
    },
  }) as LeavePayload;
}

export async function getAttendanceStaffUsers() {
  await connectToDatabase();

  const users = await UserModel.find({
    role: { $in: attendanceMemberRoles },
  })
    .sort({ role: 1, fullName: 1 })
    .select("fullName email role status")
    .lean();

  return serializeForJson(users) as AttendanceStaffUser[];
}

export async function getAdminLeaveRequests() {
  await connectToDatabase();

  const requests = await LeaveRequestModel.find({})
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("userId", "fullName email role")
    .select("userId leaveType startDateKey endDateKey totalDays reason status createdAt reviewNote")
    .lean();

  const summary = (requests as Array<{ status?: string }>).reduce(
    (acc, item) => {
      if (item.status === "pending") acc.pendingCount += 1;
      if (item.status === "approved") acc.approvedCount += 1;
      if (item.status === "rejected") acc.rejectedCount += 1;
      return acc;
    },
    { pendingCount: 0, approvedCount: 0, rejectedCount: 0 },
  );

  return serializeForJson({ requests, summary }) as AdminLeavePayload;
}

export async function getAdminDailyAttendance(dateKey: string) {
  await connectToDatabase();

  const records = await AttendanceModel.find({
    dateKey,
  })
    .sort({ dayStatus: 1, updatedAt: -1 })
    .populate("userId", "fullName email role")
    .select("userId dateKey dayStatus checkInAt checkOutAt workedMinutes totalBreakMinutes markedAt")
    .lean();

  return serializeForJson(records) as AdminDailyAttendanceRecord[];
}

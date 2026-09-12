import { connectToDatabase } from "@/lib/db/mongodb";
import { attendanceMemberRoles } from "@/lib/attendance/constants";
import { getAttendanceDateKey, getDateKeysInMonth, isWeekendDateKey } from "@/lib/attendance/date";
import { INDIA_HOLIDAYS_2026 } from "@/lib/calendar/india-holidays-2026";
import { serializeForJson } from "@/lib/utils/serialize";
import { AttendanceModel, LeaveRequestModel, UserModel } from "@/models";

// Same "safe automatic" holiday set mark-empty-days-absent.ts uses: only fixed-date national
// holidays, never a tentative festival date, which can be wrong. A festival the office actually
// observed still needs an approved leave request (or a manual attendance mark) to be paid -
// exactly the same policy that script already applies, kept consistent rather than reinvented.
const NATIONAL_HOLIDAY_DATES = new Map(
  INDIA_HOLIDAYS_2026.filter((holiday) => holiday.category === "national" && !holiday.isTentative).map(
    (holiday) => [holiday.dateKey, holiday.name] as const,
  ),
);

export type SalaryDayCategory =
  | "worked"
  | "half_day"
  | "paid_leave"
  | "unpaid_leave"
  | "absent"
  | "holiday"
  | "weekend"
  | "future";

export type SalaryDayEntry = {
  dateKey: string;
  category: SalaryDayCategory;
  note: string;
  deductionDays: number;
};

export type SalaryMonthSummary = {
  user: { _id: string; fullName: string; email: string; role: string };
  baseSalary: number | null;
  daysInMonth: number;
  dailyRate: number;
  workedDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  holidayDays: number;
  weekendDays: number;
  futureDays: number;
  deductionDays: number;
  deductionAmount: number;
  netPay: number;
};

export type SalaryMonthDetail = SalaryMonthSummary & { days: SalaryDayEntry[] };

type LeaveWindow = { startDateKey: string; endDateKey: string; leaveType: string };

const PAID_LEAVE_TYPES = new Set(["casual", "sick", "planned", "other"]);

function findApprovedLeave(dateKey: string, leaves: LeaveWindow[]) {
  return leaves.find((leave) => leave.startDateKey <= dateKey && dateKey <= leave.endDateKey);
}

function categorizeDay(params: {
  dateKey: string;
  todayDateKey: string;
  dayStatus?: "present" | "absent" | "half_day" | "late_coming";
  leaves: LeaveWindow[];
}): { category: SalaryDayCategory; note: string; deductionDays: number } {
  const { dateKey, todayDateKey, dayStatus, leaves } = params;

  if (dateKey >= todayDateKey) {
    return { category: "future", note: "Not yet happened", deductionDays: 0 };
  }
  if (isWeekendDateKey(dateKey)) {
    return { category: "weekend", note: "Weekly off", deductionDays: 0 };
  }
  if (NATIONAL_HOLIDAY_DATES.has(dateKey)) {
    return { category: "holiday", note: NATIONAL_HOLIDAY_DATES.get(dateKey)!, deductionDays: 0 };
  }
  if (dayStatus === "present" || dayStatus === "late_coming") {
    return {
      category: "worked",
      note: dayStatus === "late_coming" ? "Present (late)" : "Present",
      deductionDays: 0,
    };
  }
  if (dayStatus === "half_day") {
    return { category: "half_day", note: "Half day", deductionDays: 0.5 };
  }

  // dayStatus is "absent" or there's no attendance record at all - in both cases, whether this
  // is paid depends entirely on an approved leave request, not on the attendance record itself.
  const leave = findApprovedLeave(dateKey, leaves);
  if (leave && PAID_LEAVE_TYPES.has(leave.leaveType)) {
    return { category: "paid_leave", note: `${leave.leaveType} leave (approved)`, deductionDays: 0 };
  }
  if (leave && leave.leaveType === "unpaid") {
    return { category: "unpaid_leave", note: "Unpaid leave (approved)", deductionDays: 1 };
  }
  return { category: "absent", note: dayStatus === "absent" ? "Absent" : "No record, no leave", deductionDays: 1 };
}

function summarize(
  user: { _id: string; fullName: string; email: string; role: string },
  baseSalary: number | null,
  days: SalaryDayEntry[],
): SalaryMonthSummary {
  const daysInMonth = days.length;
  const dailyRate = baseSalary ? baseSalary / daysInMonth : 0;

  const counts = days.reduce(
    (acc, day) => {
      if (day.category === "worked") acc.workedDays += 1;
      else if (day.category === "half_day") acc.halfDays += 1;
      else if (day.category === "paid_leave") acc.paidLeaveDays += 1;
      else if (day.category === "unpaid_leave") acc.unpaidLeaveDays += 1;
      else if (day.category === "absent") acc.absentDays += 1;
      else if (day.category === "holiday") acc.holidayDays += 1;
      else if (day.category === "weekend") acc.weekendDays += 1;
      else if (day.category === "future") acc.futureDays += 1;
      acc.deductionDays += day.deductionDays;
      return acc;
    },
    {
      workedDays: 0,
      halfDays: 0,
      paidLeaveDays: 0,
      unpaidLeaveDays: 0,
      absentDays: 0,
      holidayDays: 0,
      weekendDays: 0,
      futureDays: 0,
      deductionDays: 0,
    },
  );

  const deductionAmount = Math.round(dailyRate * counts.deductionDays);
  const netPay = baseSalary ? Math.round(baseSalary - deductionAmount) : 0;

  return {
    user,
    baseSalary,
    daysInMonth,
    dailyRate: Math.round(dailyRate),
    ...counts,
    deductionAmount,
    netPay,
  };
}

async function loadMonthLeaves(userIds: string[], monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const monthStartKey = `${monthKey}-01`;
  const monthEndKey = `${monthKey}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;

  const requests = await LeaveRequestModel.find({
    userId: { $in: userIds },
    status: "approved",
    startDateKey: { $lte: monthEndKey },
    endDateKey: { $gte: monthStartKey },
  })
    .select("userId leaveType startDateKey endDateKey")
    .lean();

  const byUser = new Map<string, LeaveWindow[]>();
  for (const request of requests) {
    const key = String(request.userId);
    const list = byUser.get(key) ?? [];
    list.push({
      startDateKey: request.startDateKey,
      endDateKey: request.endDateKey,
      leaveType: request.leaveType,
    });
    byUser.set(key, list);
  }
  return byUser;
}

export async function computeMonthlySalaryForAllStaff(monthKey: string): Promise<SalaryMonthSummary[]> {
  await connectToDatabase();

  const [staffUsers, attendanceRecords] = await Promise.all([
    UserModel.find({ role: { $in: attendanceMemberRoles } })
      .sort({ fullName: 1 })
      .select("fullName email role baseSalary")
      .lean(),
    AttendanceModel.find({ dateKey: { $regex: `^${monthKey}` } })
      .select("userId dateKey dayStatus")
      .lean(),
  ]);

  const userIds = staffUsers.map((user) => String(user._id));
  const leavesByUser = await loadMonthLeaves(userIds, monthKey);

  const attendanceByUser = new Map<string, Map<string, "present" | "absent" | "half_day" | "late_coming">>();
  for (const record of attendanceRecords) {
    const key = String(record.userId);
    const map = attendanceByUser.get(key) ?? new Map();
    map.set(record.dateKey, record.dayStatus);
    attendanceByUser.set(key, map);
  }

  const dateKeys = getDateKeysInMonth(monthKey);
  const todayDateKey = getAttendanceDateKey();

  const summaries = staffUsers.map((user) => {
    const userId = String(user._id);
    const attendanceMap = attendanceByUser.get(userId) ?? new Map();
    const leaves = leavesByUser.get(userId) ?? [];

    const days = dateKeys.map((dateKey) => {
      const { category, note, deductionDays } = categorizeDay({
        dateKey,
        todayDateKey,
        dayStatus: attendanceMap.get(dateKey),
        leaves,
      });
      return { dateKey, category, note, deductionDays };
    });

    return summarize(
      { _id: userId, fullName: user.fullName, email: user.email, role: user.role },
      typeof user.baseSalary === "number" ? user.baseSalary : null,
      days,
    );
  });

  return serializeForJson(summaries) as SalaryMonthSummary[];
}

export async function computeMonthlySalaryForUser(userId: string, monthKey: string): Promise<SalaryMonthDetail | null> {
  await connectToDatabase();

  const user = await UserModel.findById(userId).select("fullName email role baseSalary").lean();
  if (!user) return null;

  const [attendanceRecords, leavesByUser] = await Promise.all([
    AttendanceModel.find({ userId, dateKey: { $regex: `^${monthKey}` } })
      .select("dateKey dayStatus")
      .lean(),
    loadMonthLeaves([userId], monthKey),
  ]);

  const attendanceMap = new Map(attendanceRecords.map((record) => [record.dateKey, record.dayStatus] as const));
  const leaves = leavesByUser.get(userId) ?? [];
  const dateKeys = getDateKeysInMonth(monthKey);
  const todayDateKey = getAttendanceDateKey();

  const days = dateKeys.map((dateKey) => {
    const { category, note, deductionDays } = categorizeDay({
      dateKey,
      todayDateKey,
      dayStatus: attendanceMap.get(dateKey),
      leaves,
    });
    return { dateKey, category, note, deductionDays };
  });

  const summary = summarize(
    { _id: String(user._id), fullName: user.fullName, email: user.email, role: user.role },
    typeof user.baseSalary === "number" ? user.baseSalary : null,
    days,
  );

  return serializeForJson({ ...summary, days }) as SalaryMonthDetail;
}

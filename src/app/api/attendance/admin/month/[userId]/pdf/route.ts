import { renderToBuffer } from "@react-pdf/renderer";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { fail, handleApiError } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceAdminRoles, attendanceMemberRoles } from "@/lib/attendance/constants";
import { getAttendanceMonthKey, getDateKeysInMonth } from "@/lib/attendance/date";
import { AttendanceModel, UserModel } from "@/models";
import {
  MonthlyAttendanceReportDocument,
  type MonthlyReportRow,
  type MonthlyReportSummary,
} from "@/lib/attendance/monthly-report-pdf";

type Params = Promise<{ userId: string }>;

// Same timezone the rest of the app is built around (lib/attendance/date.ts). Formatting times
// with the server's own local zone instead of an explicit one here would be a real bug, not just a
// style choice - this app's VPS runs in UTC, so an unqualified toLocaleTimeString() would print
// every check-in 5.5 hours off from what the dashboard itself shows for the same record.
const TIME_ZONE = "Asia/Kolkata";

function formatDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const weekday = date.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" });
  const day = date.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short" });
  return `${day} (${weekday})`;
}

function formatTime(value: string | null | undefined) {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString("en-US", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
}

function formatWorkTime(minutes = 0) {
  if (minutes <= 0) return "--";
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function isWeekendDateKeyUtc(dateKey: string) {
  const day = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  late_coming: "Late Coming",
  absent: "Absent",
  half_day: "Half Day",
};

export async function GET(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceAdminRoles });

    const { userId } = await params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return fail("Staff member not found.", 404);
    }

    const { searchParams } = new URL(request.url);
    const monthKey = searchParams.get("month") ?? getAttendanceMonthKey();
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return fail("Invalid month format.", 422);
    }

    const user = await UserModel.findById(userId).select("fullName role").lean();
    if (!user || !attendanceMemberRoles.includes(user.role)) {
      return fail("Staff member not found.", 404);
    }

    const records = await AttendanceModel.find({ userId, dateKey: { $regex: `^${monthKey}` } })
      .select("dateKey dayStatus checkInAt checkOutAt workedMinutes totalBreakMinutes markedByAdminId")
      .populate("markedByAdminId", "fullName")
      .lean();
    const recordsByDate = new Map(records.map((record) => [record.dateKey, record] as const));

    const summary: MonthlyReportSummary = { presentDays: 0, lateComingDays: 0, absentDays: 0, halfDays: 0, totalMarkedDays: 0 };
    const rows: MonthlyReportRow[] = getDateKeysInMonth(monthKey).map((dateKey) => {
      const record = recordsByDate.get(dateKey);
      const statusLabel = record ? STATUS_LABEL[record.dayStatus] ?? record.dayStatus : isWeekendDateKeyUtc(dateKey) ? "Weekend" : "Not Marked";

      if (record?.dayStatus === "present") summary.presentDays += 1;
      else if (record?.dayStatus === "late_coming") summary.lateComingDays += 1;
      else if (record?.dayStatus === "absent") summary.absentDays += 1;
      else if (record?.dayStatus === "half_day") summary.halfDays += 1;
      if (record) summary.totalMarkedDays += 1;

      // markedByAdminId is null both for a real check-in-derived record AND for the auto-generated
      // absences from scripts/mark-empty-days-absent.ts (deliberately, so an automated default
      // never gets mistaken for a specific admin's judgement call) - it is only ever set when
      // someone actually used Admin > Mark attendance for this exact day, which is precisely what
      // "changed by admin" should mean here.
      const adminEditor = record?.markedByAdminId as unknown as { fullName?: string } | null | undefined;

      return {
        dateKey,
        dayLabel: formatDateLabel(dateKey),
        statusLabel,
        checkIn: formatTime(record?.checkInAt as unknown as string | null),
        checkOut: formatTime(record?.checkOutAt as unknown as string | null),
        workTime: record?.checkInAt && !record?.checkOutAt ? "In progress" : formatWorkTime(record?.workedMinutes),
        breakMinutes: record?.totalBreakMinutes ?? 0,
        adminEditedBy: adminEditor?.fullName ?? null,
      };
    });

    const monthLabel = new Date(`${monthKey}-01T00:00:00.000Z`).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    });
    const generatedOnLabel = new Date().toLocaleString("en-US", {
      timeZone: TIME_ZONE,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const pdf = await renderToBuffer(
      MonthlyAttendanceReportDocument({
        employeeName: user.fullName,
        employeeRole: user.role,
        monthLabel,
        generatedOnLabel,
        rows,
        summary,
      }),
    );

    const safeName = user.fullName.replace(/[^a-z0-9]+/gi, "_").slice(0, 60);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}-${monthKey}-attendance.pdf"`,
        "Content-Length": String(pdf.length),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

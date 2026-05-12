import { AttendanceAdminDesk } from "@/components/attendance/attendance-admin-desk";
import { AttendanceTracker } from "@/components/attendance/attendance-tracker";
import { DashboardHeader } from "@/components/dashboard/header";
import { requireRoleAccess } from "@/lib/auth/role-access";
import {
  attendanceAdminRoles,
  attendanceDashboardRoles,
  attendanceMemberRoles,
} from "@/lib/attendance/constants";
import { getAttendanceDateKey, getAttendanceMonthKey } from "@/lib/attendance/date";
import {
  getAdminDailyAttendance,
  getAdminMonthlyAttendance,
  getAttendanceOverview,
  getAttendanceStaffUsers,
} from "@/lib/attendance/queries";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const session = await requireRoleAccess(attendanceDashboardRoles, { redirectTo: "/dashboard" });

  if (attendanceAdminRoles.includes(session.role)) {
    const initialDailyDateKey = getAttendanceDateKey();
    const initialMonthKey = getAttendanceMonthKey();
    const [staffUsers, initialDailyRecords, initialMonthlyData] = await Promise.all([
      getAttendanceStaffUsers(),
      getAdminDailyAttendance(initialDailyDateKey),
      getAdminMonthlyAttendance(initialMonthKey),
    ]);

    return (
      <section className="space-y-6">
        <DashboardHeader
          title="Attendance Command Center"
          subtitle="Mark attendance manually for any date and review day/month records."
          showLeadCta={false}
        />
        <AttendanceAdminDesk
          staffUsers={staffUsers}
          initialDailyDateKey={initialDailyDateKey}
          initialDailyRecords={initialDailyRecords}
          initialMonthKey={initialMonthKey}
          initialMonthlyData={initialMonthlyData}
        />
      </section>
    );
  }

  if (!attendanceMemberRoles.includes(session.role)) {
    return null;
  }

  const initialData = await getAttendanceOverview(session.userId);

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Attendance Desk"
        subtitle="Daily check-in and check-out tracking for team members."
        showLeadCta={false}
      />
      <AttendanceTracker initialData={initialData} />
    </section>
  );
}

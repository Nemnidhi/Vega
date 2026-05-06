import { AttendanceAdminDesk } from "@/components/attendance/attendance-admin-desk";
import { AttendanceTracker } from "@/components/attendance/attendance-tracker";
import { DashboardHeader } from "@/components/dashboard/header";
import { requireRoleAccess } from "@/lib/auth/role-access";
import {
  attendanceAdminRoles,
  attendanceDashboardRoles,
  attendanceMemberRoles,
} from "@/lib/attendance/constants";
import { getAttendanceDateKey } from "@/lib/attendance/date";
import {
  getAdminDailyAttendance,
  getAttendanceOverview,
  getAttendanceStaffUsers,
} from "@/lib/attendance/queries";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const session = await requireRoleAccess(attendanceDashboardRoles, { redirectTo: "/dashboard" });

  if (attendanceAdminRoles.includes(session.role)) {
    const initialDailyDateKey = getAttendanceDateKey();
    const [staffUsers, initialDailyRecords] = await Promise.all([
      getAttendanceStaffUsers(),
      getAdminDailyAttendance(initialDailyDateKey),
    ]);

    return (
      <section className="space-y-6">
        <DashboardHeader
          title="Attendance Command Center"
          subtitle="Mark daily attendance for staff and review day-level logs."
          showLeadCta={false}
        />
        <AttendanceAdminDesk
          staffUsers={staffUsers}
          initialDailyDateKey={initialDailyDateKey}
          initialDailyRecords={initialDailyRecords}
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

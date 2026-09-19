import { AttendanceAdminDesk } from "@/components/attendance/attendance-admin-desk";
import { AttendanceHero } from "@/components/attendance/attendance-hero";
import { AttendanceTracker } from "@/components/attendance/attendance-tracker";
import { requireRoleAccess } from "@/lib/auth/role-access";
import {
  attendanceAdminRoles,
  attendanceDashboardRoles,
  attendanceMemberRoles,
} from "@/lib/attendance/constants";
import { getAttendanceDateKey, getAttendanceMonthKey } from "@/lib/attendance/date";
import { getAttendanceGeofenceSettings } from "@/lib/attendance/geofence";
import { getAttendanceLateRule } from "@/lib/attendance/late-rule";
import {
  getAdminDailyAttendance,
  getAdminLeaveRequests,
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
    const [
      staffUsers,
      initialDailyRecords,
      initialLeaveData,
      initialMonthlyData,
      initialGeofenceSettings,
      initialLateRule,
    ] = await Promise.all([
      getAttendanceStaffUsers(),
      getAdminDailyAttendance(initialDailyDateKey),
      getAdminLeaveRequests(),
      getAdminMonthlyAttendance(initialMonthKey),
      getAttendanceGeofenceSettings(),
      getAttendanceLateRule(),
    ]);

    return (
      <AttendanceAdminDesk
        staffUsers={staffUsers}
        initialDailyDateKey={initialDailyDateKey}
        initialDailyRecords={initialDailyRecords}
        initialLeaveData={initialLeaveData}
        initialMonthKey={initialMonthKey}
        initialMonthlyData={initialMonthlyData}
        initialGeofenceSettings={initialGeofenceSettings}
        initialLateRule={initialLateRule}
      />
    );
  }

  if (!attendanceMemberRoles.includes(session.role)) {
    return null;
  }

  const initialData = await getAttendanceOverview(session.userId);

  return (
    <section className="-mx-3 sm:-mx-5 lg:-mx-[22px]">
      <AttendanceHero />
      <div className="px-4 pt-5 sm:px-6">
        <AttendanceTracker initialData={initialData} />
      </div>
    </section>
  );
}

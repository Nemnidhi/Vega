import { SalaryAdminDesk } from "@/components/salary/salary-admin-desk";
import { SalaryEmployeeView } from "@/components/salary/salary-employee-view";
import { attendanceAdminRoles, attendanceDashboardRoles, attendanceMemberRoles } from "@/lib/attendance/constants";
import { getAttendanceMonthKey } from "@/lib/attendance/date";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { computeMonthlySalaryForAllStaff, computeMonthlySalaryForUser } from "@/lib/salary/calculator";

export const dynamic = "force-dynamic";

export default async function SalaryPage() {
  const session = await requireRoleAccess(attendanceDashboardRoles, { redirectTo: "/dashboard" });

  const initialMonthKey = getAttendanceMonthKey();

  if (attendanceAdminRoles.includes(session.role)) {
    const initialRows = await computeMonthlySalaryForAllStaff(initialMonthKey);
    return <SalaryAdminDesk initialMonthKey={initialMonthKey} initialRows={initialRows} />;
  }

  if (!attendanceMemberRoles.includes(session.role)) {
    return null;
  }

  const initialDetail = await computeMonthlySalaryForUser(session.userId, initialMonthKey);
  return <SalaryEmployeeView initialMonthKey={initialMonthKey} initialDetail={initialDetail} />;
}

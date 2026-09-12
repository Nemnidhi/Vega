import { SalaryAdminDesk } from "@/components/salary/salary-admin-desk";
import { attendanceAdminRoles } from "@/lib/attendance/constants";
import { getAttendanceMonthKey } from "@/lib/attendance/date";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { computeMonthlySalaryForAllStaff } from "@/lib/salary/calculator";

export const dynamic = "force-dynamic";

export default async function SalaryPage() {
  await requireRoleAccess(attendanceAdminRoles, { redirectTo: "/dashboard" });

  const initialMonthKey = getAttendanceMonthKey();
  const initialRows = await computeMonthlySalaryForAllStaff(initialMonthKey);

  return <SalaryAdminDesk initialMonthKey={initialMonthKey} initialRows={initialRows} />;
}

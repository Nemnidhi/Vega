import { requireRoleAccess } from "@/lib/auth/role-access";
import { connectToDatabase } from "@/lib/db/mongodb";
import { listSalesTargets } from "@/lib/sales-targets/service";
import { SalesTargetsWorkspace, type SalesTargetsData } from "@/components/sales-targets/sales-targets-workspace";
import { getAttendanceMonthKey } from "@/lib/attendance/date";

export const dynamic = "force-dynamic";
export default async function SalesTargetsPage() {
  const session = await requireRoleAccess(["admin", "sales"]);
  await connectToDatabase();
  const data = await listSalesTargets(session) as SalesTargetsData;
  const currentMonth = getAttendanceMonthKey();
  return <SalesTargetsWorkspace initialData={data} isAdmin={session.role === "admin"} currentMonth={currentMonth} />;
}

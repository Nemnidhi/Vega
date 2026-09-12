import { connectToDatabase } from "@/lib/db/mongodb";
import { fail, handleApiError } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceAdminRoles } from "@/lib/attendance/constants";
import { getAttendanceMonthKey } from "@/lib/attendance/date";
import { objectIdSchema } from "@/lib/validation/common";
import { computeMonthlySalaryForUser } from "@/lib/salary/calculator";
import { buildPayslipPdf } from "@/lib/salary/payslip-response";

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceAdminRoles });

    const { userId } = await params;
    objectIdSchema.parse(userId);

    const { searchParams } = new URL(request.url);
    const monthKey = searchParams.get("month") ?? getAttendanceMonthKey();
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return fail("Invalid month format.", 422);
    }

    const detail = await computeMonthlySalaryForUser(userId, monthKey);
    if (!detail) {
      return fail("Employee not found.", 404);
    }
    if (detail.baseSalary === null) {
      return fail("Base salary is not set for this employee yet.", 422);
    }

    return buildPayslipPdf(detail, monthKey);
  } catch (error) {
    return handleApiError(error);
  }
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { fail, handleApiError } from "@/lib/api/responses";
import { getActorContext } from "@/lib/auth/permissions";
import { attendanceMemberRoles } from "@/lib/attendance/constants";
import { getAttendanceMonthKey } from "@/lib/attendance/date";
import { computeMonthlySalaryForUser } from "@/lib/salary/calculator";
import { buildPayslipPdf } from "@/lib/salary/payslip-response";

// Self-service, same as /api/salary/month - no userId input, always the caller's own payslip.
export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    if (!attendanceMemberRoles.includes(actor.role)) {
      return fail(`Forbidden for role ${actor.role}`, 403);
    }

    const { searchParams } = new URL(request.url);
    const monthKey = searchParams.get("month") ?? getAttendanceMonthKey();
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return fail("Invalid month format.", 422);
    }

    const detail = await computeMonthlySalaryForUser(actor.userId, monthKey);
    if (!detail) {
      return fail("Employee not found.", 404);
    }
    if (detail.baseSalary === null) {
      return fail("Your base salary hasn't been set yet - ask an admin to configure it.", 422);
    }

    return buildPayslipPdf(detail, monthKey);
  } catch (error) {
    return handleApiError(error);
  }
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceAdminRoles } from "@/lib/attendance/constants";
import { getAttendanceMonthKey } from "@/lib/attendance/date";
import { computeMonthlySalaryForUser } from "@/lib/salary/calculator";
import { objectIdSchema } from "@/lib/validation/common";

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

    return ok(detail);
  } catch (error) {
    return handleApiError(error);
  }
}

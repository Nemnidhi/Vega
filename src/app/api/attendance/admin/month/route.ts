import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceAdminRoles } from "@/lib/attendance/constants";
import { getAttendanceMonthKey } from "@/lib/attendance/date";
import { getAdminMonthlyAttendance } from "@/lib/attendance/queries";

export async function GET(request: Request) {
  try {
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceAdminRoles });

    const { searchParams } = new URL(request.url);
    const monthKey = searchParams.get("month") ?? getAttendanceMonthKey();

    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return fail("Invalid month format.", 422);
    }

    const data = await getAdminMonthlyAttendance(monthKey);
    return ok(data);
  } catch (error) {
    return handleApiError(error);
  }
}

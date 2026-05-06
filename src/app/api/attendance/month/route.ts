import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceMemberRoles } from "@/lib/attendance/constants";
import { getAttendanceMonthKey } from "@/lib/attendance/date";
import { getAttendanceCalendarMonth } from "@/lib/attendance/queries";

export async function GET(request: Request) {
  try {
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceMemberRoles });

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const monthKey = month ?? getAttendanceMonthKey();

    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return fail("Invalid month format. Use YYYY-MM.", 422);
    }

    const payload = await getAttendanceCalendarMonth(actor.userId, monthKey);
    return ok(payload);
  } catch (error) {
    return handleApiError(error);
  }
}

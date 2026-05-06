import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceAdminRoles } from "@/lib/attendance/constants";
import { getAttendanceDateKey } from "@/lib/attendance/date";
import { getAdminDailyAttendance } from "@/lib/attendance/queries";

export async function GET(request: Request) {
  try {
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceAdminRoles });

    const { searchParams } = new URL(request.url);
    const dateKey = searchParams.get("dateKey") ?? getAttendanceDateKey();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return fail("Invalid dateKey format.", 422);
    }

    const records = await getAdminDailyAttendance(dateKey);
    return ok({ dateKey, records });
  } catch (error) {
    return handleApiError(error);
  }
}

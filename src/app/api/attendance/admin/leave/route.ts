import { handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceAdminRoles } from "@/lib/attendance/constants";
import { getAdminLeaveRequests } from "@/lib/attendance/queries";

export async function GET() {
  try {
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceAdminRoles });
    const payload = await getAdminLeaveRequests();
    return ok(payload);
  } catch (error) {
    return handleApiError(error);
  }
}

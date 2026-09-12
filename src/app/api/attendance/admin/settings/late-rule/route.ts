import { connectToDatabase } from "@/lib/db/mongodb";
import { handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceAdminRoles } from "@/lib/attendance/constants";
import {
  attendanceLateRuleSchema,
  getAttendanceLateRule,
  saveAttendanceLateRule,
} from "@/lib/attendance/late-rule";

// Separate from admin/settings (office geofence) rather than merged into it: same underlying
// document, but a distinct endpoint means this can't accidentally change geofence-save behavior,
// and a client that only wants one of the two doesn't need to know the other's shape.

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceAdminRoles });
    const rule = await getAttendanceLateRule();
    return ok(rule);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceAdminRoles });
    const rule = attendanceLateRuleSchema.parse(await request.json());
    const saved = await saveAttendanceLateRule(rule, actor.userId);
    return ok(saved);
  } catch (error) {
    return handleApiError(error);
  }
}

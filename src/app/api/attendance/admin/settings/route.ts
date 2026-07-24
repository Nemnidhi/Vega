import { connectToDatabase } from "@/lib/db/mongodb";
import { handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceAdminRoles } from "@/lib/attendance/constants";
import {
  attendanceGeofenceSettingsSchema,
  getAttendanceGeofenceSettings,
  saveAttendanceGeofenceSettings,
} from "@/lib/attendance/geofence";

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceAdminRoles });
    const settings = await getAttendanceGeofenceSettings();
    return ok(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceAdminRoles });
    const settings = attendanceGeofenceSettingsSchema.parse(await request.json());
    const savedSettings = await saveAttendanceGeofenceSettings(settings, actor.userId);
    return ok(savedSettings);
  } catch (error) {
    return handleApiError(error);
  }
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceMemberRoles } from "@/lib/attendance/constants";
import { getAttendanceDateKey } from "@/lib/attendance/date";
import {
  assertInsideAttendanceGeofence,
  attendanceLocationSchema,
} from "@/lib/attendance/geofence";
import { getAttendanceOverview } from "@/lib/attendance/queries";
import { getAttendanceLateRule, resolveCheckInDayStatus } from "@/lib/attendance/late-rule";
import { serializeForJson } from "@/lib/utils/serialize";
import { AttendanceModel } from "@/models";

export async function GET() {
  try {
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceMemberRoles });
    const overview = await getAttendanceOverview(actor.userId);
    return ok(overview);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceMemberRoles });
    const location = attendanceLocationSchema.parse(await request.json());
    const geofenceResult = await assertInsideAttendanceGeofence(location);
    const checkInLocation = {
      ...location,
      distanceMeters: geofenceResult.distanceMeters,
    };

    const todayDateKey = getAttendanceDateKey();
    const existingEntry = await AttendanceModel.findOne({
      userId: actor.userId,
      dateKey: todayDateKey,
    });

    if (existingEntry?.checkOutAt) {
      return fail("Attendance already completed for today.", 409);
    }
    if (existingEntry?.dayStatus === "absent" || existingEntry?.dayStatus === "half_day") {
      return fail("Attendance has been marked by admin for today.", 409);
    }
    if (existingEntry?.checkInAt) {
      return fail("You are already checked in for today.", 409);
    }

    const checkInAt = new Date();
    // Computed fresh from THIS check-in's own timestamp against the configured shift rule (see
    // lib/attendance/late-rule.ts) - not copied from any previous value on the record, so a
    // re-check-in after an admin reset is judged on when it actually happened, not on stale state.
    // Returns "present" unconditionally when no rule is configured, so this stays a no-op until an
    // admin deliberately sets a shift start time.
    const lateRule = await getAttendanceLateRule();
    const dayStatus = resolveCheckInDayStatus(checkInAt, lateRule);

    if (existingEntry) {
      existingEntry.dayStatus = dayStatus;
      existingEntry.checkInAt = checkInAt;
      existingEntry.checkInLocation = checkInLocation;
      existingEntry.checkOutAt = null;
      existingEntry.checkOutLocation = null;
      existingEntry.workedMinutes = 0;
      existingEntry.totalBreakMinutes = 0;
      existingEntry.breakSessions = [];
      existingEntry.markedByAdminId = null;
      existingEntry.markedAt = null;
      await existingEntry.save();
      return ok(serializeForJson(existingEntry));
    }

    const entry = await AttendanceModel.create({
      userId: actor.userId,
      dateKey: todayDateKey,
      dayStatus,
      checkInAt,
      checkInLocation,
    });

    return ok(serializeForJson(entry), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

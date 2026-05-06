import { connectToDatabase } from "@/lib/db/mongodb";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceMemberRoles } from "@/lib/attendance/constants";
import { getAttendanceDateKey } from "@/lib/attendance/date";
import { getAttendanceOverview } from "@/lib/attendance/queries";
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

export async function POST() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceMemberRoles });

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
    if (existingEntry && existingEntry.dayStatus === "present") {
      existingEntry.checkInAt = new Date();
      existingEntry.checkOutAt = null;
      existingEntry.workedMinutes = 0;
      existingEntry.totalBreakMinutes = 0;
      existingEntry.breakSessions = [];
      await existingEntry.save();
      return ok(serializeForJson(existingEntry));
    }

    const entry = await AttendanceModel.create({
      userId: actor.userId,
      dateKey: todayDateKey,
      dayStatus: "present",
      checkInAt: new Date(),
    });

    return ok(serializeForJson(entry), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

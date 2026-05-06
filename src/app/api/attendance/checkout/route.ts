import { connectToDatabase } from "@/lib/db/mongodb";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceMemberRoles } from "@/lib/attendance/constants";
import { calculateWorkedMinutes, getAttendanceDateKey } from "@/lib/attendance/date";
import { serializeForJson } from "@/lib/utils/serialize";
import { AttendanceModel } from "@/models";

type BreakSessionItem = {
  endAt: Date | null;
  minutes?: number;
};

export async function PATCH() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceMemberRoles });

    const todayDateKey = getAttendanceDateKey();
    const entry = await AttendanceModel.findOne({
      userId: actor.userId,
      dateKey: todayDateKey,
    });

    if (!entry) {
      return fail("No active attendance found. Please check in first.", 404);
    }
    if (entry.dayStatus !== "present") {
      return fail("Cannot check out when attendance is not marked present.", 409);
    }
    if (entry.checkOutAt) {
      return fail("You have already checked out for today.", 409);
    }
    const breakSessions = (entry.breakSessions ?? []) as BreakSessionItem[];
    if (breakSessions.some((item: BreakSessionItem) => !item.endAt)) {
      return fail("Please end your active break before check-out.", 409);
    }

    const checkedOutAt = new Date();
    entry.totalBreakMinutes = breakSessions.reduce(
      (sum: number, item: BreakSessionItem) => sum + (item.minutes ?? 0),
      0,
    );
    entry.checkOutAt = checkedOutAt;
    entry.workedMinutes = calculateWorkedMinutes(
      entry.checkInAt,
      checkedOutAt,
      entry.totalBreakMinutes,
    );
    await entry.save();

    return ok(serializeForJson(entry));
  } catch (error) {
    return handleApiError(error);
  }
}

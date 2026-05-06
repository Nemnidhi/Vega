import { connectToDatabase } from "@/lib/db/mongodb";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceMemberRoles } from "@/lib/attendance/constants";
import { getAttendanceDateKey } from "@/lib/attendance/date";
import { serializeForJson } from "@/lib/utils/serialize";
import { AttendanceModel } from "@/models";

type BreakSessionItem = {
  startAt: Date;
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
      return fail("Break is only allowed when attendance is marked present.", 409);
    }
    if (entry.checkOutAt) {
      return fail("You are already checked out for today.", 409);
    }

    const breakSessions = (entry.breakSessions ?? []) as BreakSessionItem[];
    const hasActiveBreak = breakSessions.some((item: BreakSessionItem) => !item.endAt);
    if (hasActiveBreak) {
      return fail("A break is already in progress.", 409);
    }

    entry.breakSessions = breakSessions;
    entry.breakSessions.push({
      startAt: new Date(),
      endAt: null,
      minutes: 0,
    });
    await entry.save();

    return ok(serializeForJson(entry));
  } catch (error) {
    return handleApiError(error);
  }
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceMemberRoles } from "@/lib/attendance/constants";
import {
  calculateMinutesBetween,
  calculateWorkedMinutes,
  getAttendanceDateKey,
} from "@/lib/attendance/date";
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
    const activeBreak = breakSessions.find((item: BreakSessionItem) => !item.endAt);
    if (!activeBreak) {
      return fail("No active break found.", 409);
    }

    const breakEndAt = new Date();
    activeBreak.endAt = breakEndAt;
    activeBreak.minutes = calculateMinutesBetween(activeBreak.startAt, breakEndAt);
    entry.totalBreakMinutes = breakSessions.reduce(
      (sum: number, item: BreakSessionItem) => sum + (item.minutes ?? 0),
      0,
    );

    if (entry.checkOutAt) {
      entry.workedMinutes = calculateWorkedMinutes(
        entry.checkInAt,
        entry.checkOutAt,
        entry.totalBreakMinutes,
      );
    }

    await entry.save();

    return ok(serializeForJson(entry));
  } catch (error) {
    return handleApiError(error);
  }
}

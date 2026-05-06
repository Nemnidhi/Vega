import { connectToDatabase } from "@/lib/db/mongodb";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceAdminRoles, attendanceMemberRoles } from "@/lib/attendance/constants";
import { adminMarkAttendanceSchema } from "@/lib/validation/attendance-leave";
import { serializeForJson } from "@/lib/utils/serialize";
import { AttendanceModel, UserModel } from "@/models";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceAdminRoles });

    const payload = adminMarkAttendanceSchema.parse(await request.json());
    const targetUser = await UserModel.findById(payload.userId).select("role").lean();
    if (!targetUser) {
      return fail("User not found.", 404);
    }
    if (!attendanceMemberRoles.includes(targetUser.role)) {
      return fail("Attendance can only be marked for staff members.", 409);
    }

    const existingRecord = await AttendanceModel.findOne({
      userId: payload.userId,
      dateKey: payload.dateKey,
    });

    if (!existingRecord) {
      const created = await AttendanceModel.create({
        userId: payload.userId,
        dateKey: payload.dateKey,
        dayStatus: payload.dayStatus,
        checkInAt: null,
        checkOutAt: null,
        workedMinutes: 0,
        totalBreakMinutes: 0,
        breakSessions: [],
        markedByAdminId: actor.userId,
        markedAt: new Date(),
      });
      return ok(serializeForJson(created), { status: 201 });
    }

    if (payload.dayStatus !== "present") {
      existingRecord.checkInAt = null;
      existingRecord.checkOutAt = null;
      existingRecord.workedMinutes = 0;
      existingRecord.totalBreakMinutes = 0;
      existingRecord.breakSessions = [];
    }

    existingRecord.dayStatus = payload.dayStatus;
    existingRecord.markedByAdminId = actor.userId;
    existingRecord.markedAt = new Date();
    await existingRecord.save();

    return ok(serializeForJson(existingRecord));
  } catch (error) {
    return handleApiError(error);
  }
}

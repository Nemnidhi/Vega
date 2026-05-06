import { connectToDatabase } from "@/lib/db/mongodb";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceAdminRoles } from "@/lib/attendance/constants";
import { ensureLeaveBalanceForUser } from "@/lib/attendance/leave-balance";
import { reviewLeaveRequestSchema } from "@/lib/validation/attendance-leave";
import { objectIdSchema } from "@/lib/validation/common";
import { serializeForJson } from "@/lib/utils/serialize";
import { LeaveRequestModel } from "@/models";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceAdminRoles });

    const { id } = await params;
    const leaveRequestId = objectIdSchema.parse(id);
    const payload = reviewLeaveRequestSchema.parse(await request.json());

    const leaveRequest = await LeaveRequestModel.findById(leaveRequestId);
    if (!leaveRequest) {
      return fail("Leave request not found.", 404);
    }
    if (leaveRequest.status !== "pending") {
      return fail("Only pending leave requests can be reviewed.", 409);
    }

    if (payload.status === "approved") {
      const leaveBalance = await ensureLeaveBalanceForUser(String(leaveRequest.userId));
      if (leaveRequest.totalDays > leaveBalance.availableDays) {
        return fail(
          `Insufficient leave balance. Available balance is ${leaveBalance.availableDays} day(s).`,
          409,
        );
      }

      leaveBalance.availableDays -= leaveRequest.totalDays;
      leaveBalance.totalUsedDays += leaveRequest.totalDays;
      await leaveBalance.save();
    }

    leaveRequest.status = payload.status;
    leaveRequest.reviewNote = payload.reviewNote;
    leaveRequest.reviewedBy = actor.userId;
    leaveRequest.reviewedAt = new Date();
    await leaveRequest.save();

    return ok(serializeForJson(leaveRequest));
  } catch (error) {
    return handleApiError(error);
  }
}

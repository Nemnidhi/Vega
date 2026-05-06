import { connectToDatabase } from "@/lib/db/mongodb";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceMemberRoles } from "@/lib/attendance/constants";
import { calculateInclusiveDateSpanDays } from "@/lib/attendance/date";
import { ensureLeaveBalanceForUser } from "@/lib/attendance/leave-balance";
import { getLeaveRequestsForUser } from "@/lib/attendance/queries";
import { createLeaveRequestSchema } from "@/lib/validation/attendance-leave";
import { serializeForJson } from "@/lib/utils/serialize";
import { LeaveRequestModel } from "@/models";

export async function GET() {
  try {
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceMemberRoles });
    const payload = await getLeaveRequestsForUser(actor.userId);
    return ok(payload);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceMemberRoles });

    const parsed = createLeaveRequestSchema.parse(await request.json());
    const totalDays = calculateInclusiveDateSpanDays(
      parsed.startDateKey,
      parsed.endDateKey,
    );
    const leaveBalance = await ensureLeaveBalanceForUser(actor.userId);

    const overlapping = await LeaveRequestModel.findOne({
      userId: actor.userId,
      status: { $in: ["pending", "approved"] },
      startDateKey: { $lte: parsed.endDateKey },
      endDateKey: { $gte: parsed.startDateKey },
    }).lean();
    if (overlapping) {
      return fail("Overlapping leave request already exists.", 409);
    }

    const pendingRequests = await LeaveRequestModel.find({
      userId: actor.userId,
      status: "pending",
    })
      .select("totalDays")
      .lean();
    const pendingRequestedDays = (
      pendingRequests as Array<{
        totalDays?: number;
      }>
    ).reduce((sum, item) => sum + (item.totalDays ?? 0), 0);

    const requestableDays = Math.max(0, leaveBalance.availableDays - pendingRequestedDays);
    if (totalDays > requestableDays) {
      return fail(
        `Insufficient leave balance. Available to request: ${requestableDays} day(s).`,
        409,
      );
    }

    const leaveRequest = await LeaveRequestModel.create({
      userId: actor.userId,
      leaveType: parsed.leaveType,
      startDateKey: parsed.startDateKey,
      endDateKey: parsed.endDateKey,
      totalDays,
      reason: parsed.reason,
      status: "pending",
    });

    return ok(serializeForJson(leaveRequest), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

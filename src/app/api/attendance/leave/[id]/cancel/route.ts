import { connectToDatabase } from "@/lib/db/mongodb";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceMemberRoles } from "@/lib/attendance/constants";
import { objectIdSchema } from "@/lib/validation/common";
import { serializeForJson } from "@/lib/utils/serialize";
import { LeaveRequestModel } from "@/models";

type Params = Promise<{ id: string }>;

export async function PATCH(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceMemberRoles });

    const { id } = await params;
    const requestId = objectIdSchema.parse(id);

    const leaveRequest = await LeaveRequestModel.findOne({
      _id: requestId,
      userId: actor.userId,
    });
    if (!leaveRequest) {
      return fail("Leave request not found.", 404);
    }
    if (leaveRequest.status !== "pending") {
      return fail("Only pending leave requests can be cancelled.", 409);
    }

    leaveRequest.status = "cancelled";
    await leaveRequest.save();

    return ok(serializeForJson(leaveRequest));
  } catch (error) {
    return handleApiError(error);
  }
}

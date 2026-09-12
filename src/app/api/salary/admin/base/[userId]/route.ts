import { connectToDatabase } from "@/lib/db/mongodb";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { attendanceAdminRoles } from "@/lib/attendance/constants";
import { setBaseSalarySchema } from "@/lib/validation/salary";
import { objectIdSchema } from "@/lib/validation/common";
import { serializeForJson } from "@/lib/utils/serialize";
import { UserModel } from "@/models";

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: attendanceAdminRoles });

    const { userId } = await params;
    objectIdSchema.parse(userId);
    const payload = setBaseSalarySchema.parse(await request.json());

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { baseSalary: payload.baseSalary } },
      { new: true },
    )
      .select("fullName email role baseSalary")
      .lean();

    if (!user) {
      return fail("Employee not found.", 404);
    }

    return ok(serializeForJson(user));
  } catch (error) {
    return handleApiError(error);
  }
}

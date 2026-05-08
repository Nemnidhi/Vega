import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { LOGIN_ROLES } from "@/lib/auth/constants";
import { objectIdSchema } from "@/lib/validation/common";
import { updateUserSchema } from "@/lib/validation/user";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageUsers });

    const { id } = await params;
    const userId = objectIdSchema.parse(id);
    const payload = updateUserSchema.parse(await request.json());

    const user = await UserModel.findOne({ _id: userId, role: { $in: LOGIN_ROLES } });
    if (!user) {
      return fail("User not found.", 404);
    }

    if (payload.email) {
      const normalizedEmail = payload.email.toLowerCase();
      const existingWithEmail = await UserModel.findOne({
        email: normalizedEmail,
        _id: { $ne: userId },
      })
        .select("_id")
        .lean();
      if (existingWithEmail) {
        return fail("Account already exists with this email.", 409);
      }
      user.email = normalizedEmail;
    }

    if (payload.fullName) {
      user.fullName = payload.fullName;
    }
    if (payload.role) {
      user.role = payload.role;
    }
    if (payload.status) {
      user.status = payload.status;
    }
    if (payload.password) {
      user.passwordHash = hashPassword(payload.password);
    }

    await user.save();

    return ok(
      serializeForJson({
        id: String(user._id),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageUsers });

    const { id } = await params;
    const userId = objectIdSchema.parse(id);

    if (actor.userId.toLowerCase() === userId.toLowerCase()) {
      return fail("You cannot delete your own account.", 400);
    }

    const user = await UserModel.findOne({ _id: userId, role: { $in: LOGIN_ROLES } })
      .select("_id role")
      .lean();
    if (!user) {
      return fail("User not found.", 404);
    }

    if (user.role === "admin") {
      const remainingAdmins = await UserModel.countDocuments({
        role: "admin",
        _id: { $ne: userId },
      });
      if (remainingAdmins === 0) {
        return fail("Cannot delete the last admin account.", 409);
      }
    }

    await UserModel.deleteOne({ _id: userId });

    return ok({ id: userId, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

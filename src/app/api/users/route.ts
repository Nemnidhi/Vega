import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { LOGIN_ROLES } from "@/lib/auth/constants";
import { createUserSchema } from "@/lib/validation/user";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageUsers });

    const users = await UserModel.find({ role: { $in: LOGIN_ROLES } })
      .sort({ createdAt: -1 })
      .select("fullName email role status lastLoginAt createdAt")
      .lean();

    return ok(serializeForJson(users));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageUsers });

    const payload = createUserSchema.parse(await request.json());
    const normalizedEmail = payload.email.toLowerCase();

    const existingUser = await UserModel.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      return fail("Account already exists with this email.", 409);
    }

    const user = await UserModel.create({
      fullName: payload.fullName,
      email: normalizedEmail,
      role: payload.role,
      passwordHash: hashPassword(payload.password),
      status: payload.status,
    });

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
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

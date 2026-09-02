import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { LOGIN_ROLES } from "@/lib/auth/constants";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { assertAuthRateLimit } from "@/lib/rate-limit";
import { handleApiError, ok, fail } from "@/lib/api/responses";
import { passwordChangeRequestSchema } from "@/lib/validation/user";
import { PasswordChangeRequestModel, UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

function toPasswordChangeRequestItem(request: {
  _id: unknown;
  userId?: {
    _id?: unknown;
    fullName?: string;
    email?: string;
    role?: string;
  };
  status: string;
  createdAt?: Date;
  reviewedAt?: Date | null;
  reviewNote?: string;
}) {
  return {
    id: String(request._id),
    user: request.userId
      ? {
          id: String(request.userId._id),
          fullName: request.userId.fullName,
          email: request.userId.email,
          role: request.userId.role,
        }
      : null,
    status: request.status,
    createdAt: request.createdAt,
    reviewedAt: request.reviewedAt,
    reviewNote: request.reviewNote ?? "",
  };
}

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageUsers });

    const requests = await PasswordChangeRequestModel.find({})
      .sort({ status: 1, createdAt: -1 })
      .limit(100)
      .populate("userId", "fullName email role")
      .select("userId status createdAt reviewedAt reviewNote")
      .lean();

    return ok(serializeForJson(requests.map(toPasswordChangeRequestItem)));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    if (!LOGIN_ROLES.includes(actor.role as (typeof LOGIN_ROLES)[number])) {
      throw new Error("Forbidden for role");
    }

    const payload = passwordChangeRequestSchema.parse(await request.json());
    const user = await UserModel.findOne({
      _id: actor.userId,
      role: { $in: LOGIN_ROLES },
      status: "active",
    })
      .select("_id passwordHash")
      .lean();

    if (!user) {
      return fail("Active staff user not found.", 404);
    }

    await assertAuthRateLimit(request, "password_change_request", actor.userId);

    if (!user.passwordHash || !verifyPassword(payload.currentPassword, user.passwordHash)) {
      return fail("Your current password is incorrect.", 401);
    }

    const existingPendingRequest = await PasswordChangeRequestModel.findOne({
      userId: actor.userId,
      status: "pending",
    })
      .select("_id")
      .lean();

    if (existingPendingRequest) {
      return fail("A password change request is already pending admin approval.", 409);
    }

    const createdRequest = await PasswordChangeRequestModel.create({
      userId: actor.userId,
      requestedPasswordHash: hashPassword(payload.newPassword),
      status: "pending",
    });

    return ok(
      serializeForJson({
        id: String(createdRequest._id),
        status: createdRequest.status,
        createdAt: createdRequest.createdAt,
      }),
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok, fail } from "@/lib/api/responses";
import { objectIdSchema } from "@/lib/validation/common";
import { reviewPasswordChangeRequestSchema } from "@/lib/validation/user";
import { PasswordChangeRequestModel, UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageUsers });

    const { id } = await params;
    const requestId = objectIdSchema.parse(id);
    const payload = reviewPasswordChangeRequestSchema.parse(await request.json());

    const passwordRequest = await PasswordChangeRequestModel.findById(requestId);
    if (!passwordRequest) {
      return fail("Password change request not found.", 404);
    }

    if (passwordRequest.status !== "pending") {
      return fail("This password change request has already been reviewed.", 409);
    }

    if (payload.action === "approve") {
      const user = await UserModel.findById(passwordRequest.userId);
      if (!user) {
        return fail("Requesting user not found.", 404);
      }
      user.passwordHash = passwordRequest.requestedPasswordHash;
      // A new password signs out everywhere - that is the point of changing it.
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;
      await user.save();
      passwordRequest.status = "approved";
    } else {
      passwordRequest.status = "rejected";
    }

    passwordRequest.reviewedBy = actor.userId;
    passwordRequest.reviewedAt = new Date();
    passwordRequest.reviewNote = payload.reviewNote ?? "";
    await passwordRequest.save();

    const reviewedRequest = await PasswordChangeRequestModel.findById(requestId)
      .populate("userId", "fullName email role")
      .select("userId status createdAt reviewedAt reviewNote")
      .lean();

    return ok(serializeForJson(reviewedRequest));
  } catch (error) {
    return handleApiError(error);
  }
}

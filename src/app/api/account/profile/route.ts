import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { LOGIN_ROLES } from "@/lib/auth/constants";
import { handleApiError, ok, fail } from "@/lib/api/responses";
import { updateOwnProfileSchema } from "@/lib/validation/user";
import { UserModel } from "@/models";

/**
 * Self-service profile edit.
 *
 * Editing a user went through /api/users/[id], which requires manageUsers - so
 * changing your own phone number meant asking an admin. This accepts only the
 * fields that describe the person: name, phone, department. Role, status, email
 * and salary are not reachable here at any cost, because they decide access and
 * pay; the id is taken from the session and never from the request, so this
 * cannot be pointed at somebody else's account.
 */
export async function PATCH(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    if (!LOGIN_ROLES.includes(actor.role as (typeof LOGIN_ROLES)[number])) {
      throw new Error("Forbidden for role");
    }

    const payload = updateOwnProfileSchema.parse(await request.json());

    const user = await UserModel.findById(actor.userId);
    if (!user) return fail("Account not found.", 404);

    if (payload.fullName !== undefined) user.fullName = payload.fullName;
    if (payload.phone !== undefined) user.phone = payload.phone;
    if (payload.department !== undefined) user.department = payload.department;
    await user.save();

    // Not written to the activity log: it has no "user" entity type, and
    // widening an audit schema as a side effect of a profile form is the wrong
    // trade. Worth adding deliberately if profile edits should be auditable.

    return ok({
      fullName: user.fullName,
      phone: user.phone ?? "",
      department: user.department ?? "",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { ActivityLogModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { atLeast: "project_manager" });

    const logs = await ActivityLogModel.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("actorId", "fullName role")
      .lean();

    return ok(serializeForJson(logs));
  } catch (error) {
    return handleApiError(error);
  }
}

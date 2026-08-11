import { connectToDatabase } from "@/lib/db/mongodb";
import { BlueprintModel } from "@/models";
import { getCurrentSession } from "@/lib/auth/session";
import { assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity/logging";
import { handleApiError, fail, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ leadId: string }>;

export async function POST(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const session = await getCurrentSession();
    if (!session) throw new Error("Unauthorized");
    assertRoleAccess(session.role, { oneOf: permissionRules.manageLeads });

    const { leadId } = await params;
    const blueprint = await BlueprintModel.findOne({ leadId }).sort({ version: -1 });
    if (!blueprint) {
      return fail("No blueprint draft to share - create one first", 404);
    }
    if (blueprint.status !== "draft") {
      return fail(`Only a draft blueprint can be shared (current status: ${blueprint.status})`, 409);
    }

    blueprint.status = "shared";
    blueprint.sharedAt = new Date();
    await blueprint.save();

    await logActivity({
      action: "blueprint_shared",
      actorId: session.userId,
      entityType: "blueprint",
      entityId: String(blueprint._id),
      details: { leadId, version: blueprint.version },
    });

    return ok(serializeForJson(blueprint.toObject()));
  } catch (error) {
    return handleApiError(error);
  }
}

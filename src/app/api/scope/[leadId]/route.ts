import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { ScopeManifestModel } from "@/models";
import { upsertScopeManifestSchema } from "@/lib/validation/scope-manifest";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ leadId: string }>;

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageScope });

    const { leadId } = await params;
    const scopeManifest = await ScopeManifestModel.findOne({ leadId }).lean();
    return ok(serializeForJson(scopeManifest));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageScope });

    const payload = upsertScopeManifestSchema.parse(await request.json());
    const { leadId } = await params;
    if (payload.leadId !== leadId) {
      throw new Error("leadId mismatch between URL and payload");
    }

    const update = {
      ...payload,
      signedAt: payload.signedAt ? new Date(payload.signedAt) : null,
      preparedBy: actor.userId,
      approvedBy: payload.isCompleted ? actor.userId : null,
    };

    const scopeManifest = await ScopeManifestModel.findOneAndUpdate(
      { leadId },
      update,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    await logActivity({
      action: "scope_manifest_edited",
      actorId: actor.userId,
      entityType: "scope_manifest",
      entityId: String(scopeManifest._id),
      details: { leadId, isCompleted: scopeManifest.isCompleted },
    });

    return ok(serializeForJson(scopeManifest));
  } catch (error) {
    return handleApiError(error);
  }
}

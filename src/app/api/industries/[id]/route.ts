import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { upsertIndustrySchema } from "@/lib/validation/industry";
import { IndustryModel } from "@/models";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.managePricing });

    const payload = upsertIndustrySchema.partial().parse(await request.json());
    const { id } = await params;

    const industry = await IndustryModel.findById(id);
    if (!industry) {
      throw new Error("Industry not found");
    }

    Object.assign(industry, payload);
    await industry.save();

    await logActivity({
      action: "industry_changed",
      actorId: actor.userId,
      entityType: "industry",
      entityId: String(industry._id),
      details: { key: industry.key, label: industry.label },
    });

    return ok(serializeForJson(industry));
  } catch (error) {
    return handleApiError(error);
  }
}

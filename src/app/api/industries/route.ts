import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { upsertIndustrySchema } from "@/lib/validation/industry";
import { IndustryModel } from "@/models";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { atLeast: "sales" });

    const industries = await IndustryModel.find({}).sort({ sortOrder: 1, label: 1 }).lean();
    return ok(serializeForJson(industries));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.managePricing });

    const payload = upsertIndustrySchema.parse(await request.json());

    const industry = await IndustryModel.findOneAndUpdate(
      { key: payload.key },
      payload,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    await logActivity({
      action: "industry_changed",
      actorId: actor.userId,
      entityType: "industry",
      entityId: String(industry._id),
      details: { key: industry.key, label: industry.label },
    });

    return ok(serializeForJson(industry), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

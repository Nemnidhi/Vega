import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { upsertIndustrySegmentSchema } from "@/lib/validation/industry";
import { IndustrySegmentModel } from "@/models";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { atLeast: "sales" });

    const industryId = new URL(request.url).searchParams.get("industryId");
    const filter = industryId ? { industryId } : {};

    const segments = await IndustrySegmentModel.find(filter)
      .sort({ sortOrder: 1, label: 1 })
      .lean();
    return ok(serializeForJson(segments));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.managePricing });

    const payload = upsertIndustrySegmentSchema.parse(await request.json());

    const segment = await IndustrySegmentModel.findOneAndUpdate(
      { industryId: payload.industryId, key: payload.key },
      payload,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    await logActivity({
      action: "industry_segment_changed",
      actorId: actor.userId,
      entityType: "industry_segment",
      entityId: String(segment._id),
      details: { key: segment.key, label: segment.label, industryId: payload.industryId },
    });

    return ok(serializeForJson(segment), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

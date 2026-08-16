import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { upsertIndustrySegmentSchema } from "@/lib/validation/industry";
import { IndustrySegmentModel } from "@/models";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.managePricing });

    const payload = upsertIndustrySegmentSchema.partial().parse(await request.json());
    const { id } = await params;

    const segment = await IndustrySegmentModel.findById(id);
    if (!segment) {
      throw new Error("Industry segment not found");
    }

    Object.assign(segment, payload);
    await segment.save();

    await logActivity({
      action: "industry_segment_changed",
      actorId: actor.userId,
      entityType: "industry_segment",
      entityId: String(segment._id),
      details: { key: segment.key, label: segment.label },
    });

    return ok(serializeForJson(segment));
  } catch (error) {
    return handleApiError(error);
  }
}

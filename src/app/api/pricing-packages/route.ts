import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { upsertPricingPackageSchema } from "@/lib/validation/pricing-package";
import { PricingPackageModel } from "@/models";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { atLeast: "sales" });

    const url = new URL(request.url);
    const industryId = url.searchParams.get("industryId");
    const segmentIdParam = url.searchParams.get("segmentId");

    const filter: Record<string, unknown> = {};
    if (industryId) filter.industryId = industryId;
    // "null" is passed explicitly by the UI to mean "no segment breakdown",
    // distinct from the param being absent entirely (no segment filter at all).
    if (segmentIdParam !== null) {
      filter.segmentId = segmentIdParam === "null" ? null : segmentIdParam;
    }

    const packages = await PricingPackageModel.find(filter).lean();
    return ok(serializeForJson(packages));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.managePricing });

    const payload = upsertPricingPackageSchema.parse(await request.json());

    const pkg = await PricingPackageModel.findOneAndUpdate(
      { industryId: payload.industryId, segmentId: payload.segmentId, tierId: payload.tierId },
      payload,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    await logActivity({
      action: "pricing_package_changed",
      actorId: actor.userId,
      entityType: "pricing_package",
      entityId: String(pkg._id),
      details: {
        industryId: payload.industryId,
        segmentId: payload.segmentId,
        tierId: payload.tierId,
        setupPrice: pkg.setupPrice,
        monthlyPrice: pkg.monthlyPrice,
      },
    });

    return ok(serializeForJson(pkg), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

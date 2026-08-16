import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { upsertPricingTierSchema } from "@/lib/validation/pricing-package";
import { PricingTierModel } from "@/models";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { atLeast: "sales" });

    const tiers = await PricingTierModel.find({}).sort({ order: 1 }).lean();
    return ok(serializeForJson(tiers));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.managePricing });

    const payload = upsertPricingTierSchema.parse(await request.json());

    const tier = await PricingTierModel.findOneAndUpdate(
      { key: payload.key },
      payload,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    await logActivity({
      action: "pricing_tier_changed",
      actorId: actor.userId,
      entityType: "pricing_tier",
      entityId: String(tier._id),
      details: { key: tier.key, label: tier.label },
    });

    return ok(serializeForJson(tier), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

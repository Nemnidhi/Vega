import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { upsertPricingTierSchema } from "@/lib/validation/pricing-package";
import { PricingTierModel } from "@/models";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.managePricing });

    const payload = upsertPricingTierSchema.partial().parse(await request.json());
    const { id } = await params;

    const tier = await PricingTierModel.findById(id);
    if (!tier) {
      throw new Error("Pricing tier not found");
    }

    Object.assign(tier, payload);
    await tier.save();

    await logActivity({
      action: "pricing_tier_changed",
      actorId: actor.userId,
      entityType: "pricing_tier",
      entityId: String(tier._id),
      details: { key: tier.key, label: tier.label },
    });

    return ok(serializeForJson(tier));
  } catch (error) {
    return handleApiError(error);
  }
}

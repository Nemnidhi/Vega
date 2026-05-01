import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { upsertPricingComponentSchema } from "@/lib/validation/pricing-component";
import { PricingComponentModel } from "@/models";
import { computeFinalPrice } from "@/lib/pricing/engine";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.managePricing });

    const payload = upsertPricingComponentSchema.partial().parse(await request.json());
    const { id } = await params;

    const existing = await PricingComponentModel.findById(id);
    if (!existing) {
      throw new Error("Pricing component not found");
    }

    const merged = {
      basePrice: payload.basePrice ?? existing.basePrice,
      complexityMultiplier: payload.complexityMultiplier ?? existing.complexityMultiplier,
      marginPercentage: payload.marginPercentage ?? existing.marginPercentage,
    };
    const computed = computeFinalPrice(merged);

    Object.assign(existing, payload, computed);
    await existing.save();

    await logActivity({
      action: "pricing_changed",
      actorId: actor.userId,
      entityType: "pricing_component",
      entityId: String(existing._id),
      details: { code: existing.code, finalPrice: existing.finalPrice },
    });

    return ok(serializeForJson(existing));
  } catch (error) {
    return handleApiError(error);
  }
}

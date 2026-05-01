import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { upsertPricingComponentSchema } from "@/lib/validation/pricing-component";
import { PricingComponentModel } from "@/models";
import { computeFinalPrice } from "@/lib/pricing/engine";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { atLeast: "sales" });

    const components = await PricingComponentModel.find({})
      .sort({ isActive: -1, updatedAt: -1 })
      .lean();
    return ok(serializeForJson(components));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.managePricing });

    const payload = upsertPricingComponentSchema.parse(await request.json());
    const computed = computeFinalPrice(payload);

    const component = await PricingComponentModel.findOneAndUpdate(
      { code: payload.code },
      { ...payload, ...computed },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    await logActivity({
      action: "pricing_changed",
      actorId: actor.userId,
      entityType: "pricing_component",
      entityId: String(component._id),
      details: { code: component.code, finalPrice: component.finalPrice },
    });

    return ok(serializeForJson(component), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

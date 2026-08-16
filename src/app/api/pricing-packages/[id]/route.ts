import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { upsertPricingPackageSchema } from "@/lib/validation/pricing-package";
import { PricingPackageModel } from "@/models";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.managePricing });

    const payload = upsertPricingPackageSchema.partial().parse(await request.json());
    const { id } = await params;

    const pkg = await PricingPackageModel.findById(id);
    if (!pkg) {
      throw new Error("Pricing package not found");
    }

    Object.assign(pkg, payload);
    await pkg.save();

    await logActivity({
      action: "pricing_package_changed",
      actorId: actor.userId,
      entityType: "pricing_package",
      entityId: String(pkg._id),
      details: { setupPrice: pkg.setupPrice, monthlyPrice: pkg.monthlyPrice },
    });

    return ok(serializeForJson(pkg));
  } catch (error) {
    return handleApiError(error);
  }
}

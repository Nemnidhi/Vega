import { connectToDatabase } from "@/lib/db/mongodb";
import { PricingComponentModel } from "@/models";
import type { CatalogComponent } from "@/lib/pricing/smb-catalog";

/**
 * The real, marketing-editable catalog (Industry/IndustrySegment/PricingTier/
 * PricingPackage work, 2026-08-16) - migrated from the actual pricing sheet,
 * not the older smb-catalog.ts placeholder data. recommendComponents() takes
 * its catalog as a plain argument, so this is the only piece needed to point
 * a recommendation flow at real prices instead of "UNVERIFIED"/"PURE
 * PLACEHOLDER" guesses.
 *
 * The staff-facing Blueprint route (api/blueprint/[leadId]/route.ts) still
 * calls recommendComponents(smbCatalog, ...) - a pre-existing inconsistency,
 * not something this change fixes. Worth unifying both call sites onto this
 * source later, not bundled into the self-service work that needed it first.
 */
export async function getDbPricingCatalog(): Promise<CatalogComponent[]> {
  await connectToDatabase();

  const components = await PricingComponentModel.find({ isActive: true }).lean();

  return components.map((component) => ({
    code: component.code,
    title: component.title,
    description: component.description,
    category: component.category,
    department: component.department as CatalogComponent["department"],
    basePrice: component.basePrice,
    complexityMultiplier: component.complexityMultiplier,
    marginPercentage: component.marginPercentage,
    monthlyPrice: component.monthlyPrice ?? 0,
    deliveryWeeksMin: component.deliveryWeeksMin ?? 1,
    deliveryWeeksMax: component.deliveryWeeksMax ?? 2,
    answersGapTags: component.answersGapTags ?? [],
    appliesToIndustries: component.appliesToIndustries ?? [],
    scaleTiers: (component.scaleTiers ?? []) as CatalogComponent["scaleTiers"],
    priceBasis: component.priceBasis,
    features: (component.features ?? []).map((feature: (typeof component.features)[number]) => ({
      code: feature.code,
      label: feature.label,
      description: feature.description,
      priceImpact: feature.priceImpact,
      isDefault: feature.isDefault,
      requires: feature.requires,
    })),
  }));
}

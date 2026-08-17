import { connectToDatabase } from "@/lib/db/mongodb";
import {
  IndustryModel,
  IndustrySegmentModel,
  PricingTierModel,
  PricingPackageModel,
  PricingComponentModel,
} from "@/models";

export interface PackageComponentLine {
  code: string;
  title: string;
  oneTimePrice: number;
  monthlyPrice: number;
  deliveryWeeksMin: number;
  deliveryWeeksMax: number;
  features: Array<{ code: string; label: string; description?: string; priceImpact: number; isDefault: boolean }>;
}

export interface ResolvedPackage {
  packageId: string;
  tierKey: string;
  tierLabel: string;
  setupPrice: number;
  monthlyPrice: number;
  included: PackageComponentLine[];
  addons: PackageComponentLine[];
}

/**
 * Resolves a client's (industry, segment, tier) choice to the matching
 * PricingPackage and joins in the real price/feature data for every
 * included/addon component - the digital equivalent of reading one column
 * of the marketing team's pricing sheet.
 *
 * Returns null if no package is configured for that exact combination (a
 * gap in the seeded data, not an error) - the caller should surface a clean
 * "not set up yet" message rather than guessing.
 */
export async function resolvePricingPackage(
  industryKey: string,
  segmentKey: string | null | undefined,
  tierKey: string,
): Promise<ResolvedPackage | null> {
  await connectToDatabase();

  const [industry, tier] = await Promise.all([
    IndustryModel.findOne({ key: industryKey, isActive: true }).lean(),
    PricingTierModel.findOne({ key: tierKey, isActive: true }).lean(),
  ]);
  if (!industry || !tier) return null;

  let segmentId: string | null = null;
  if (segmentKey) {
    const segment = await IndustrySegmentModel.findOne({
      industryId: industry._id,
      key: segmentKey,
      isActive: true,
    }).lean();
    if (!segment) return null;
    segmentId = String(segment._id);
  }

  const pkg = await PricingPackageModel.findOne({
    industryId: industry._id,
    segmentId,
    tierId: tier._id,
    isActive: true,
  }).lean();
  if (!pkg) return null;

  type Inclusion = (typeof pkg.componentInclusions)[number];
  const componentIds = pkg.componentInclusions
    .filter((inclusion: Inclusion) => inclusion.status !== "unavailable")
    .map((inclusion: Inclusion) => inclusion.componentId);

  const components = await PricingComponentModel.find({ _id: { $in: componentIds }, isActive: true }).lean();
  const componentById = new Map(components.map((c) => [String(c._id), c]));

  const included: PackageComponentLine[] = [];
  const addons: PackageComponentLine[] = [];

  for (const inclusion of pkg.componentInclusions) {
    if (inclusion.status === "unavailable") continue;
    const component = componentById.get(String(inclusion.componentId));
    if (!component) continue;

    const line: PackageComponentLine = {
      code: component.code,
      title: component.title,
      oneTimePrice: component.finalPrice ?? 0,
      monthlyPrice: component.monthlyPrice ?? 0,
      deliveryWeeksMin: component.deliveryWeeksMin ?? 1,
      deliveryWeeksMax: component.deliveryWeeksMax ?? 2,
      features: (component.features ?? []).map((feature: (typeof component.features)[number]) => ({
        code: feature.code,
        label: feature.label,
        description: feature.description,
        priceImpact: feature.priceImpact,
        isDefault: feature.isDefault ?? false,
      })),
    };

    if (inclusion.status === "included") included.push(line);
    else addons.push(line);
  }

  return {
    packageId: String(pkg._id),
    tierKey: tier.key,
    tierLabel: tier.label,
    setupPrice: pkg.setupPrice ?? 0,
    monthlyPrice: pkg.monthlyPrice ?? 0,
    included,
    addons,
  };
}

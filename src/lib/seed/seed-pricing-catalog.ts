import { connectToDatabase } from "@/lib/db/mongodb";
import {
  IndustryModel,
  IndustrySegmentModel,
  PricingComponentModel,
  PricingPackageModel,
  PricingTierModel,
} from "@/models";
import { computeFinalPrice } from "@/lib/pricing/engine";
import seedData from "@/lib/seed/pricing-catalog-seed-data.json";

// One-time migration of the marketing team's Excel pricing sheet
// (Business_service_pricing_tier_list.xlsx, 22 industries) into the DB-backed
// catalog. Idempotent (every write is an upsert keyed on a stable business
// key), safe to re-run - re-running after the JSON source changes just
// updates existing rows rather than duplicating them.
export async function seedPricingCatalog() {
  await connectToDatabase();

  // 1. Industries
  const industryOps = seedData.industries.map((industry) => ({
    updateOne: {
      filter: { key: industry.key },
      update: { $set: { label: industry.label, sortOrder: industry.sortOrder, isActive: true } },
      upsert: true,
    },
  }));
  if (industryOps.length > 0) await IndustryModel.bulkWrite(industryOps);
  const industries = await IndustryModel.find({}).lean();
  const industryIdByKey = new Map(industries.map((industry) => [industry.key, String(industry._id)]));

  // 2. Segments (business types) - only seeded for the industries where the
  // source sheet's Manufacturer/Wholesaler/Distributor/Retailer breakdown
  // genuinely applies (see extract_pricing_seed.py's SHEET_MAP comment).
  const segmentOps = seedData.segments
    .map((segment) => {
      const industryId = industryIdByKey.get(segment.industryKey);
      if (!industryId) return null;
      return {
        updateOne: {
          filter: { industryId, key: segment.key },
          update: { $set: { label: segment.label, sortOrder: segment.sortOrder, isActive: true } },
          upsert: true,
        },
      };
    })
    .filter((op): op is NonNullable<typeof op> => op !== null);
  if (segmentOps.length > 0) await IndustrySegmentModel.bulkWrite(segmentOps);
  const segments = await IndustrySegmentModel.find({}).lean();
  const segmentIdByIndustryAndKey = new Map(
    segments.map((segment) => [`${segment.industryId}:${segment.key}`, String(segment._id)]),
  );

  // 3. Tiers
  const tierOps = seedData.tiers.map((tier) => ({
    updateOne: {
      filter: { key: tier.key },
      update: { $set: { label: tier.label, order: tier.order, isActive: true } },
      upsert: true,
    },
  }));
  if (tierOps.length > 0) await PricingTierModel.bulkWrite(tierOps);
  const tiers = await PricingTierModel.find({}).lean();
  const tierIdByKey = new Map(tiers.map((tier) => [tier.key, String(tier._id)]));

  // 4. Components. The sheet's setup price is already a client-facing sale
  // price, not a delivery cost - basePrice is back-derived through the
  // engine's protected 20% margin floor so finalPrice reproduces the
  // original sheet figure exactly, rather than adding margin on top of an
  // already-final number.
  const componentOps = seedData.components.map((component) => {
    const basePrice = Math.round((component.basePrice / 1.2) * 100) / 100;
    const computed = computeFinalPrice({ basePrice, complexityMultiplier: 1, marginPercentage: 20 });
    return {
      updateOne: {
        filter: { code: component.code },
        update: {
          $set: {
            title: component.title,
            description: component.description,
            // Migrated rows default to "operations" for the finer category -
            // real classification (crm/automation/ai/etc.) needs a human
            // pass per component; the pillar is what actually matters for
            // package bundling and is set correctly from the sheet.
            category: "operations",
            pillar: component.pillar,
            department: component.department,
            basePrice,
            complexityMultiplier: 1,
            marginPercentage: computed.marginPercentage,
            finalPrice: computed.finalPrice,
            monthlyPrice: component.monthlyPrice,
            isActive: true,
            appliesToIndustries: component.appliesToIndustries,
            // Real per-component judgment pass (2026-09-04), not a name-match guess - see that
            // session's own notes for which 8 of 158 genuinely answer the audit's narrow
            // website/google/seo/social vocabulary (toMissingGapTags in lead-adapter.ts) and why
            // the other 150 correctly stay untagged (real CRM/ops/billing tools, not digital-
            // presence fixes). Defaults to [] for every component the JSON doesn't tag - this
            // field was previously silently dropped by this $set, even though 6 components had
            // been tagged directly in the database, bypassing this seed file entirely.
            answersGapTags: (component as { answersGapTags?: string[] }).answersGapTags ?? [],
            scaleTiers: (component as { scaleTiers?: string[] }).scaleTiers ?? [],
            priceBasis: "Migrated from Business_service_pricing_tier_list.xlsx (marketing team pricing sheet, 2026-08-16).",
          },
        },
        upsert: true,
      },
    };
  });
  if (componentOps.length > 0) await PricingComponentModel.bulkWrite(componentOps);
  const components = await PricingComponentModel.find({}).lean();
  const componentIdByCode = new Map(components.map((component) => [component.code, String(component._id)]));

  // 5. Packages
  const packageOps = seedData.packages
    .map((pkg) => {
      const industryId = industryIdByKey.get(pkg.industryKey);
      const tierId = tierIdByKey.get(pkg.tierKey);
      if (!industryId || !tierId) return null;
      const segmentId = pkg.segmentKey ? segmentIdByIndustryAndKey.get(`${industryId}:${pkg.segmentKey}`) ?? null : null;

      const componentInclusions = pkg.componentCodes
        .map((entry) => {
          const componentId = componentIdByCode.get(entry.code);
          return componentId ? { componentId, status: entry.status } : null;
        })
        .filter((entry): entry is { componentId: string; status: string } => entry !== null);

      return {
        updateOne: {
          filter: { industryId, segmentId, tierId },
          update: {
            $set: {
              bestForDescription: pkg.bestForDescription,
              setupPrice: pkg.setupPrice,
              monthlyPrice: pkg.monthlyPrice,
              pillarPricing: pkg.pillarPricing,
              componentInclusions,
              isActive: true,
            },
          },
          upsert: true,
        },
      };
    })
    .filter((op): op is NonNullable<typeof op> => op !== null);
  if (packageOps.length > 0) await PricingPackageModel.bulkWrite(packageOps);

  return {
    industries: industryOps.length,
    segments: segmentOps.length,
    tiers: tierOps.length,
    components: componentOps.length,
    packages: packageOps.length,
  };
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { DashboardHeader } from "@/components/dashboard/header";
import {
  PricingPackagePanel,
  type ComponentOption,
  type IndustryOption,
  type SegmentOption,
  type TierOption,
} from "@/components/pricing/pricing-package-panel";
import { IndustryModel, IndustrySegmentModel, PricingComponentModel, PricingTierModel } from "@/models";

export const dynamic = "force-dynamic";

export default async function PricingPackagesPage() {
  await requireRoleAccess(["admin", "partner", "sales", "digital_marketing"]);
  await connectToDatabase();

  const [industries, segments, tiers, components] = await Promise.all([
    IndustryModel.find({ isActive: true }).sort({ sortOrder: 1, label: 1 }).lean(),
    IndustrySegmentModel.find({ isActive: true }).sort({ sortOrder: 1, label: 1 }).lean(),
    PricingTierModel.find({ isActive: true }).sort({ order: 1 }).lean(),
    PricingComponentModel.find({ isActive: true }).sort({ pillar: 1, title: 1 }).lean(),
  ]);

  const industryOptions: IndustryOption[] = industries.map((industry) => ({
    id: String(industry._id),
    key: industry.key,
    label: industry.label,
  }));

  const segmentOptions: SegmentOption[] = segments.map((segment) => ({
    id: String(segment._id),
    industryId: String(segment.industryId),
    label: segment.label,
  }));

  const tierOptions: TierOption[] = tiers.map((tier) => ({
    id: String(tier._id),
    key: tier.key,
    label: tier.label,
    order: tier.order,
  }));

  const componentOptions: ComponentOption[] = components.map((component) => ({
    id: String(component._id),
    code: component.code,
    title: component.title,
    pillar: component.pillar,
  }));

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Pricing Packages"
        subtitle="Pick an industry and business type, then build each tier: package pricing and which components are Included / Add-on / Unavailable. The direct digital replacement for each industry pricing sheet."
        showLeadCta={false}
      />
      {industryOptions.length === 0 || tierOptions.length === 0 ? (
        <p className="rounded-2xl border border-warning/35 bg-warning/10 p-4 text-sm text-warning">
          {industryOptions.length === 0 ? "No industries yet - add one on the Industries page. " : ""}
          {tierOptions.length === 0 ? "No pricing tiers yet - add one on the Pricing Tiers page." : ""}
        </p>
      ) : (
        <PricingPackagePanel
          industries={industryOptions}
          segments={segmentOptions}
          tiers={tierOptions}
          components={componentOptions}
        />
      )}
    </section>
  );
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { DashboardHeader } from "@/components/dashboard/header";
import {
  PricingComponentPanel,
  type PricingComponentItem,
  type SegmentOption,
} from "@/components/pricing/pricing-component-panel";
import { IndustryModel, IndustrySegmentModel, PricingComponentModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export const dynamic = "force-dynamic";

export default async function PricingComponentsPage() {
  await requireRoleAccess(["admin", "partner", "sales", "digital_marketing"]);
  await connectToDatabase();

  const [components, segments, industries] = await Promise.all([
    PricingComponentModel.find({}).sort({ isActive: -1, updatedAt: -1 }).lean(),
    IndustrySegmentModel.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    IndustryModel.find({ isActive: true }).lean(),
  ]);

  const industryLabelById = new Map(industries.map((industry) => [String(industry._id), industry.label]));

  const segmentOptions: SegmentOption[] = segments.map((segment) => ({
    id: String(segment._id),
    label: segment.label,
    industryLabel: industryLabelById.get(String(segment.industryId)) ?? "Unknown industry",
  }));

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Pricing Catalog"
        subtitle="The individual products/solutions Nemnidhi sells - base price, margin, features, and which industries/segments each applies to. Packages (tiers) bundle these together."
        showLeadCta={false}
      />
      <PricingComponentPanel
        initialComponents={serializeForJson(components) as PricingComponentItem[]}
        segments={segmentOptions}
      />
    </section>
  );
}

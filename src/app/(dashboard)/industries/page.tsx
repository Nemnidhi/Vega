import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { DashboardHeader } from "@/components/dashboard/header";
import {
  IndustrySegmentPanel,
  type IndustryItem,
  type SegmentItem,
} from "@/components/pricing/industry-segment-panel";
import { IndustryModel, IndustrySegmentModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export const dynamic = "force-dynamic";

export default async function IndustriesPage() {
  await requireRoleAccess(["admin", "partner", "sales", "digital_marketing"]);
  await connectToDatabase();

  const [industries, segments] = await Promise.all([
    IndustryModel.find({}).sort({ sortOrder: 1, label: 1 }).lean(),
    IndustrySegmentModel.find({}).sort({ sortOrder: 1, label: 1 }).lean(),
  ]);

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Industries & Business Types"
        subtitle="The two-level taxonomy pricing packages are scoped by - add a new industry, or a new business type within one (Clinic/Doctor, Law Firm, CA Firm...) without a code change."
        showLeadCta={false}
      />
      <IndustrySegmentPanel
        initialIndustries={serializeForJson(industries) as IndustryItem[]}
        initialSegments={serializeForJson(segments) as SegmentItem[]}
      />
    </section>
  );
}

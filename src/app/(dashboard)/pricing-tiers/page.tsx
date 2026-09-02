import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { DashboardHeader } from "@/components/dashboard/header";
import { PricingTierPanel, type PricingTierItem } from "@/components/pricing/pricing-tier-panel";
import { PricingTierModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export const dynamic = "force-dynamic";

export default async function PricingTiersPage() {
  await requireRoleAccess(["admin", "partner", "sales", "digital_marketing"]);
  await connectToDatabase();

  const tiers = await PricingTierModel.find({}).sort({ order: 1 }).lean();

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Pricing Tiers"
        subtitle="The sellable package levels (Launch/Growth/Scale/Enterprise) - rename, reorder, or add a tier without a code deploy."
        showLeadCta={false}
      />
      <PricingTierPanel initialTiers={serializeForJson(tiers) as PricingTierItem[]} />
    </section>
  );
}

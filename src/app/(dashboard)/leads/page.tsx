import { DashboardHeader } from "@/components/dashboard/header";
import { LeadIntakeLauncher } from "@/components/leads/lead-intake-launcher";
import { LeadListWithStatusTabs } from "@/components/leads/lead-list-with-status-tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeads } from "@/lib/dashboard/queries";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { TIER_LABEL, TIER_ORDER, TIER_VARIANT } from "@/lib/prospecting/tier-display";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  await requireRoleAccess(["admin", "sales", "digital_marketing"]);

  const leads = (await getLeads({ limit: 200 })) as Array<{
    _id: string;
    title: string;
    contactName?: string;
    source: string;
    status: string;
    updatedAt?: string;
    prospecting?: {
      industry?: string;
      segment?: string;
      prospectingStatus?: string;
      classification?: { category?: string };
    } | null;
  }>;

  const prospects = leads.filter((lead) => Boolean(lead.prospecting));
  const tierCounts = TIER_ORDER.map((tier) => ({
    tier,
    count: prospects.filter((lead) => lead.prospecting?.classification?.category === tier).length,
  }));
  const unclassified = prospects.filter(
    (lead) => !lead.prospecting?.classification?.category,
  ).length;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <DashboardHeader
          title="Leads"
          subtitle="Create, update, and track leads in a simple CRM flow."
        />
        <LeadIntakeLauncher />
      </div>

      {prospects.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Cold Prospect Audit Coverage</CardTitle>
            <p className="text-sm text-muted-foreground">
              Digital-presence tiers across {prospects.length} cold prospects in this view. Tier A is
              the strongest opportunity for us - nothing found online at all.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {tierCounts.map(({ tier, count }) => (
                <div key={tier} className="rounded-lg border border-border bg-vega-surface-1 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={TIER_VARIANT[tier]}>Tier {tier}</Badge>
                    <span className="text-2xl font-semibold text-foreground">{count}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{TIER_LABEL[tier]}</p>
                </div>
              ))}
              <div className="rounded-lg border border-border bg-surface-soft p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="neutral">Unclassified</Badge>
                  <span className="text-2xl font-semibold text-foreground">{unclassified}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Awaiting enrichment or classification.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Lead List</CardTitle>
          <p className="text-sm text-muted-foreground">
            Showing latest 200 leads for faster loading. Open any lead for full actions.
          </p>
        </CardHeader>
        <CardContent>
          <LeadListWithStatusTabs leads={leads} />
        </CardContent>
      </Card>
    </section>
  );
}

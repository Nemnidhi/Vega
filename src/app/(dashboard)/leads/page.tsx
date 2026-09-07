import { CheckCircle2, Phone, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TIER_LABEL, TIER_ORDER, TIER_VARIANT } from "@/lib/prospecting/tier-display";
import { LeadIntakeLauncher } from "@/components/leads/lead-intake-launcher";
import { LeadListWithStatusTabs } from "@/components/leads/lead-list-with-status-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { getLeads } from "@/lib/dashboard/queries";
import { requireRoleAccess } from "@/lib/auth/role-access";

export const dynamic = "force-dynamic";

function isWithinDays(value: string | undefined, days: number) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const diff = Date.now() - parsed.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

export default async function LeadsPage() {
  await requireRoleAccess(["admin", "sales", "digital_marketing"]);

  const leads = (await getLeads({ limit: 200 })) as Array<{
    _id: string;
    title: string;
    contactName?: string;
    email?: string;
    phone?: string;
    source: string;
    status: string;
    category?: string;
    urgency?: string;
    score?: number;
    priorityBand?: string;
    createdAt?: string;
    updatedAt?: string;
    prospecting?: {
      industry?: string;
      segment?: string;
      prospectingStatus?: string;
      classification?: { category?: string };
    } | null;
  }>;

  const totalLeads = leads.length;
  const newThisWeek = leads.filter((lead) => isWithinDays(lead.createdAt, 7)).length;
  const contacted = leads.filter((lead) => lead.status === "contacted").length;
  const converted = leads.filter((lead) => lead.status === "closed_won").length;
  // Cold-prospect audit coverage: only leads that went through enrichment carry `prospecting`,
  // so tier counts are scoped to those rather than the whole 200-lead page.
  const prospects = leads.filter((lead) => Boolean(lead.prospecting));
  const tierCounts = TIER_ORDER.map((tier) => ({
    tier,
    count: prospects.filter((lead) => lead.prospecting?.classification?.category === tier).length,
  }));
  const unclassified = prospects.filter(
    (lead) => !lead.prospecting?.classification?.category,
  ).length;

  const metrics = [
    { label: "Total Leads", value: totalLeads, delta: "+12%", icon: Users, tone: "text-[#c4b5fd]", tile: "bg-vega-purple-soft" },
    { label: "New This Week", value: newThisWeek, delta: "+20%", icon: TrendingUp, tone: "text-blue-300", tile: "bg-blue-500/15" },
    { label: "Contacted", value: contacted, delta: "+8%", icon: Phone, tone: "text-[#a855f7]", tile: "bg-purple-500/15" },
    { label: "Converted", value: converted, delta: "+25%", icon: CheckCircle2, tone: "text-success", tile: "bg-success/15" },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-row flex-wrap items-end justify-between gap-3 border-b border-vega-border-soft pb-3">
        <div className="min-w-0">
          <p className="text-xs text-vega-text-muted xl:text-sm">Operations &gt; Leads</p>
          <h2 className="mt-1.5 text-[28px] font-semibold leading-8 tracking-normal text-vega-text xl:text-[28px] xl:leading-[34px]">
            Leads
          </h2>
          <p className="mt-0.5 text-sm text-vega-text-muted xl:text-sm">
            <span className="xl:hidden">Manage every opportunity.</span>
            <span className="hidden xl:inline">Capture, manage and track leads in a simple CRM flow.</span>
          </p>
        </div>
        <LeadIntakeLauncher />
      </div>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4 xl:gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <Card key={metric.label} className="border-vega-border bg-vega-surface-1">
              <CardContent className="relative flex min-h-[74px] items-center gap-2.5 p-2.5 xl:min-h-0 xl:justify-between xl:gap-4 xl:p-5">
                <div className="flex min-w-0 items-center gap-2.5 xl:gap-4">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg xl:h-14 xl:w-14 ${metric.tile}`}>
                    <Icon className={`h-5 w-5 xl:h-7 xl:w-7 ${metric.tone}`} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <p className="max-w-[72px] text-xs leading-3.5 text-vega-text-muted xl:max-w-none xl:text-sm">{metric.label}</p>
                    <p className="mt-1 text-xl font-semibold leading-none text-vega-text xl:text-3xl">{metric.value}</p>
                  </span>
                </div>
                <span className="absolute bottom-2 right-2 rounded-md border border-success/20 bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold leading-3.5 text-success xl:static xl:px-2 xl:py-1 xl:text-xs">
                  {metric.delta}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {prospects.length > 0 ? (
        <Card className="border-vega-border bg-vega-surface-1">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-vega-text">Cold Prospect Audit Coverage</h3>
            <p className="mt-0.5 text-xs text-vega-text-muted">
              Digital-presence tiers across {prospects.length} cold prospects in this view. Tier A is
              the strongest opportunity for us - nothing found online at all.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {tierCounts.map(({ tier, count }) => (
                <div key={tier} className="rounded-lg border border-vega-border bg-vega-surface-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={TIER_VARIANT[tier]}>Tier {tier}</Badge>
                    <span className="text-2xl font-semibold text-vega-text">{count}</span>
                  </div>
                  <p className="mt-2 text-xs text-vega-text-muted">{TIER_LABEL[tier]}</p>
                </div>
              ))}
              <div className="rounded-lg border border-vega-border bg-vega-surface-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="neutral">Unclassified</Badge>
                  <span className="text-2xl font-semibold text-vega-text">{unclassified}</span>
                </div>
                <p className="mt-2 text-xs text-vega-text-muted">
                  Awaiting enrichment or classification.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <LeadListWithStatusTabs leads={leads} />
    </section>
  );
}

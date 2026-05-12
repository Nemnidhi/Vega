import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDashboardMetrics } from "@/lib/dashboard/queries";
import { requireRoleAccess } from "@/lib/auth/role-access";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireRoleAccess(["admin", "sales"], { redirectTo: "/projects" });

  const metrics = (await getDashboardMetrics()) as {
    totalLeads: number;
    heavyArtilleryLeads: number;
    standardPipelineLeads: number;
    volumePipelineLeads: number;
    closedWonLeads: number;
    recentActivity: Array<{
      _id: string;
      action: string;
      entityType: string;
      createdAt: string;
    }>;
  };

  const pipelineTotal = Math.max(
    metrics.heavyArtilleryLeads + metrics.standardPipelineLeads + metrics.volumePipelineLeads,
    0,
  );
  const conversionRate = metrics.totalLeads > 0 ? Math.round((metrics.closedWonLeads / metrics.totalLeads) * 100) : 0;
  const heavyShare = pipelineTotal > 0 ? Math.round((metrics.heavyArtilleryLeads / pipelineTotal) * 100) : 0;
  const standardShare = pipelineTotal > 0 ? Math.round((metrics.standardPipelineLeads / pipelineTotal) * 100) : 0;
  const volumeShare = pipelineTotal > 0 ? Math.round((metrics.volumePipelineLeads / pipelineTotal) * 100) : 0;

  const quickActions = [
    {
      label: "Create Lead",
      href: "/leads",
    },
    {
      label: "View Pipeline",
      href: "/pipeline",
    },
    {
      label: "Open Clients",
      href: "/clients",
    },
  ];

  const mixCards = [
    {
      title: "Heavy Artillery",
      count: metrics.heavyArtilleryLeads,
      share: heavyShare,
      barClassName: "bg-accent",
    },
    {
      title: "Standard Pipeline",
      count: metrics.standardPipelineLeads,
      share: standardShare,
      barClassName: "bg-[#8da7c2]",
    },
    {
      title: "Volume Pipeline",
      count: metrics.volumePipelineLeads,
      share: volumeShare,
      barClassName: "bg-[#af9a78]",
    },
  ];

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Home Command Center"
        subtitle={`Welcome ${session.fullName ?? session.email}. Clean summary of what needs focus today.`}
      />

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-surface-soft p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Today&apos;s Focus
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                  Keep pipeline moving and close high-intent mandates faster.
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use quick actions to capture fresh leads, move active deals, and maintain clean client follow-up.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {quickActions.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="inline-flex h-10 items-center rounded-lg border border-border bg-white px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-soft"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="grid min-w-[240px] grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/70 bg-white p-3">
                  <p className="text-xs text-muted-foreground">Total Leads</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.totalLeads}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-white p-3">
                  <p className="text-xs text-muted-foreground">Pipeline Load</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{pipelineTotal}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-white p-3">
                  <p className="text-xs text-muted-foreground">Closed Won</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.closedWonLeads}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-white p-3">
                  <p className="text-xs text-muted-foreground">Conversion</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{conversionRate}%</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Snapshot</CardTitle>
            <CardDescription>
              Clear lane-wise distribution for today&apos;s execution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mixCards.map((item) => (
              <div key={item.title} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{item.title}</span>
                  <span className="text-muted-foreground">
                    {item.count} leads ({item.share}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-soft">
                  <div className={`h-full rounded-full ${item.barClassName}`} style={{ width: `${item.share}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest CRM actions from your team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {metrics.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              metrics.recentActivity.slice(0, 6).map((item) => (
                <div key={item._id} className="rounded-lg border border-border bg-white p-2.5">
                  <p className="text-sm font-medium text-foreground">
                    {item.action} | {item.entityType}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("en-IN")}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>High Value Actions</CardTitle>
          <CardDescription>
            Keep this short list as your daily operating checklist.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {[
            "Prioritize heavy artillery leads first.",
            "Move contacted leads to qualified quickly.",
            "Push proposal and negotiation leads to closure.",
          ].map((item) => (
            <div key={item} className="rounded-lg border border-border bg-white p-3 text-sm text-foreground">
              {item}
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

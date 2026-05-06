import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/header";
import { StatCard } from "@/components/dashboard/stat-card";
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
  const conversionRate =
    metrics.totalLeads > 0
      ? Math.round((metrics.closedWonLeads / metrics.totalLeads) * 100)
      : 0;
  const heavyShare =
    pipelineTotal > 0 ? Math.round((metrics.heavyArtilleryLeads / pipelineTotal) * 100) : 0;
  const standardShare =
    pipelineTotal > 0 ? Math.round((metrics.standardPipelineLeads / pipelineTotal) * 100) : 0;
  const volumeShare =
    pipelineTotal > 0 ? Math.round((metrics.volumePipelineLeads / pipelineTotal) * 100) : 0;

  const actionLinks = [
    {
      label: "Create Lead",
      href: "/leads",
      helperText: "Capture new lead details and start qualification.",
    },
    {
      label: "View Pipeline",
      href: "/pipeline",
      helperText: "Track stage movement and unblock stuck deals.",
    },
    {
      label: "Open Clients",
      href: "/clients",
      helperText: "Review active clients and latest vault updates.",
    },
    {
      label: "Team Chat",
      href: "/chat",
      helperText: "Coordinate quickly with admin, sales, and developers.",
    },
  ];

  const followupQueue = [
    {
      title: "High Intent Follow-up",
      count: metrics.heavyArtilleryLeads,
      helperText: "Prioritize these leads for direct partner-level engagement.",
    },
    {
      title: "Standard Qualification",
      count: metrics.standardPipelineLeads,
      helperText: "Move these leads through discovery and solution alignment.",
    },
    {
      title: "Volume Nurture",
      count: metrics.volumePipelineLeads,
      helperText: "Keep momentum with lightweight and consistent outreach.",
    },
  ];

  const cards = [
    {
      title: "Total Leads",
      value: String(metrics.totalLeads),
      helperText: "All captured mandates in CRM.",
      trend: "neutral" as const,
    },
    {
      title: "Heavy Artillery",
      value: String(metrics.heavyArtilleryLeads),
      helperText: "80+ score leads flagged for partner negotiation.",
      trend: metrics.heavyArtilleryLeads > 0 ? ("up" as const) : ("neutral" as const),
    },
    {
      title: "Closed Won",
      value: String(metrics.closedWonLeads),
      helperText: "Converted leads.",
      trend: "up" as const,
    },
    {
      title: "Standard Pipeline",
      value: String(metrics.standardPipelineLeads),
      helperText: "Score 50-79 handling lane.",
      trend: "neutral" as const,
    },
    {
      title: "Volume Pipeline",
      value: String(metrics.volumePipelineLeads),
      helperText: "Sub-50 leads for scale throughput.",
      trend: "neutral" as const,
    },
    {
      title: "Pipeline Load",
      value: String(pipelineTotal),
      helperText: "Active leads currently under pipeline management.",
      trend: pipelineTotal > 0 ? ("up" as const) : ("neutral" as const),
    },
    {
      title: "Conversion Rate",
      value: `${conversionRate}%`,
      helperText: "Closed won ratio across all tracked leads.",
      trend: conversionRate >= 25 ? ("up" as const) : ("neutral" as const),
    },
  ];

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Home Command Center"
        subtitle={`Welcome ${session.fullName ?? session.email}. Quick summary of leads, conversions, and next actions.`}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((item) => (
          <StatCard
            key={item.title}
            title={item.title}
            value={item.value}
            helperText={item.helperText}
            trend={item.trend}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Jump into the most-used daily workflow actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {actionLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-border bg-white p-3 transition-colors hover:border-foreground/30 hover:bg-surface-soft"
              >
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.helperText}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline Health Mix</CardTitle>
            <CardDescription>
              Distribution of active lead inventory across lanes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Heavy Artillery</span>
                <span className="font-semibold text-foreground">{heavyShare}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-soft">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${heavyShare}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Standard Pipeline</span>
                <span className="font-semibold text-foreground">{standardShare}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-soft">
                <div
                  className="h-full rounded-full bg-[#8da7c2]"
                  style={{ width: `${standardShare}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Volume Pipeline</span>
                <span className="font-semibold text-foreground">{volumeShare}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-soft">
                <div
                  className="h-full rounded-full bg-[#af9a78]"
                  style={{ width: `${volumeShare}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Follow-up Queue</CardTitle>
            <CardDescription>
              Suggested priority split for today&apos;s lead handling.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {followupQueue.map((item) => (
              <div key={item.title} className="rounded-lg border border-border bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-lg font-semibold text-foreground">{item.count}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.helperText}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Audit Activity</CardTitle>
            <CardDescription>
              Latest lead-related events from the activity log.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {metrics.recentActivity.length === 0 ? (
              <p>No activity yet.</p>
            ) : (
              metrics.recentActivity.slice(0, 8).map((item) => (
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
    </section>
  );
}

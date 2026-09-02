import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Flame,
  ListChecks,
  Radio,
  Target,
  TrendingUp,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
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
  const session = await requireRoleAccess(["admin", "sales", "digital_marketing"], {
    redirectTo: "/tasks",
  });

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
  const activeLoad = Math.max(metrics.totalLeads - metrics.closedWonLeads, 0);

  const quickActions = [
    {
      label: "Create lead",
      href: "/leads",
      helper: "Capture or qualify a new opportunity.",
    },
    {
      label: "View pipeline",
      href: "/pipeline",
      helper: "Review lanes and blocked follow-ups.",
    },
    {
      label: "Open clients",
      href: "/clients",
      helper: "Check client health and handoffs.",
    },
  ];

  const mixCards = [
    {
      title: "Heavy Artillery",
      count: metrics.heavyArtilleryLeads,
      share: heavyShare,
      colorClassName: "bg-vega-purple",
      tintClassName: "bg-vega-purple-soft text-[#c4b5fd]",
    },
    {
      title: "Standard Pipeline",
      count: metrics.standardPipelineLeads,
      share: standardShare,
      colorClassName: "bg-vega-blue",
      tintClassName: "bg-vega-blue-soft text-[#93c5fd]",
    },
    {
      title: "Volume Pipeline",
      count: metrics.volumePipelineLeads,
      share: volumeShare,
      colorClassName: "bg-vega-cyan",
      tintClassName: "bg-vega-cyan-soft text-vega-cyan",
    },
  ];

  const kpiCards = [
    {
      label: "Open Leads",
      value: metrics.totalLeads,
      helper: "All captured opportunities",
      change: "+12% vs last 7 days",
      Icon: Target,
      colorClassName: "text-vega-purple",
      tileClassName: "bg-vega-purple-soft border-vega-purple-border",
      barClassName: "bg-vega-purple",
      width: "76%",
    },
    {
      label: "Qualified Leads",
      value: pipelineTotal,
      helper: "Segmented execution load",
      change: `${standardShare}% standard mix`,
      Icon: CheckCircle2,
      colorClassName: "text-vega-blue",
      tileClassName: "bg-vega-blue-soft border-vega-blue/35",
      barClassName: "bg-vega-blue",
      width: `${Math.max(standardShare, 18)}%`,
    },
    {
      label: "Active Projects",
      value: activeLoad,
      helper: "Leads still moving",
      change: `${conversionRate}% conversion`,
      Icon: Radio,
      colorClassName: "text-vega-green",
      tileClassName: "bg-vega-green-soft border-vega-green/35",
      barClassName: "bg-vega-green",
      width: `${Math.max(conversionRate, 22)}%`,
    },
    {
      label: "Blocked Tasks",
      value: metrics.heavyArtilleryLeads,
      helper: "High-intensity follow-up",
      change: `${heavyShare}% heavy share`,
      Icon: Flame,
      colorClassName: "text-vega-orange",
      tileClassName: "bg-vega-orange-soft border-vega-orange/35",
      barClassName: "bg-vega-orange",
      width: `${Math.max(heavyShare, 20)}%`,
    },
    {
      label: "Pending Approvals",
      value: metrics.volumePipelineLeads,
      helper: "Volume opportunities",
      change: `${volumeShare}% volume mix`,
      Icon: Clock3,
      colorClassName: "text-vega-yellow",
      tileClassName: "bg-vega-yellow-soft border-vega-yellow/35",
      barClassName: "bg-vega-yellow",
      width: `${Math.max(volumeShare, 16)}%`,
    },
    {
      label: "Revenue Pipeline",
      value: metrics.closedWonLeads,
      helper: "Closed-won outcomes",
      change: "Won lead count",
      Icon: CircleDollarSign,
      colorClassName: "text-vega-purple",
      tileClassName: "bg-vega-purple-soft border-vega-purple-border",
      barClassName: "bg-vega-purple",
      width: `${Math.max(conversionRate, 14)}%`,
    },
  ];

  const priorities = [
    {
      title: "Prioritize heavy artillery leads",
      context: `${metrics.heavyArtilleryLeads} high-intensity leads`,
      state: "Attention",
      variant: "warning" as const,
    },
    {
      title: "Advance qualified opportunities",
      context: `${pipelineTotal} active segmented leads`,
      state: "Active",
      variant: "accent" as const,
    },
    {
      title: "Close proposal and negotiation lanes",
      context: `${metrics.closedWonLeads} closed-won opportunities`,
      state: "Tracked",
      variant: "success" as const,
    },
  ];

  return (
    <section className="space-y-4">
      <DashboardHeader
        title="Command Center"
        subtitle={`Welcome ${session.fullName ?? session.email}. A structured overview for lead flow, client movement, and daily execution.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpiCards.map((item) => (
          <Card key={item.label} className="min-h-[128px]">
            <CardContent className="flex h-full flex-col justify-between gap-3 p-3.5">
              <div className="flex items-start gap-3">
                <div className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border ${item.tileClassName}`}>
                  <item.Icon className={`h-5 w-5 ${item.colorClassName}`} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium leading-4 text-vega-text-secondary">{item.label}</p>
                  <p className="mt-1 text-[21px] font-semibold leading-6 text-vega-text">{item.value}</p>
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-2 text-[10px] leading-4">
                  <span className="text-vega-text-muted">{item.helper}</span>
                  <span className="text-vega-green">{item.change}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-sm bg-[#263445]">
                  <div className={`h-full rounded-sm ${item.barClassName}`} style={{ width: item.width }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.35fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Lead to Delivery Funnel</CardTitle>
            <CardDescription>Commercial lanes mapped to execution priority.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mixCards.map((item) => (
              <div key={item.title} className="border-b border-vega-border-soft pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`flex h-6 min-w-6 items-center justify-center rounded ${item.tintClassName}`}>
                      <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="truncate text-xs font-medium text-vega-text">{item.title}</span>
                  </div>
                  <span className="text-[11px] text-vega-text-muted">
                    {item.count} leads
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-[#263445]">
                  <div className={`h-full rounded-sm ${item.colorClassName}`} style={{ width: `${item.share}%` }} />
                </div>
                <p className="mt-1 text-[10px] leading-4 text-vega-text-dim">{item.share}% of active pipeline</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Execution Overview</CardTitle>
            <CardDescription>
              Operating posture across conversion, pipeline load and closure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["Conversion", `${conversionRate}%`, "Won against total"],
                ["Pipeline Load", pipelineTotal, "Segmented active leads"],
                ["Closed Won", metrics.closedWonLeads, "Commercial wins"],
              ].map(([label, value, helper]) => (
                <div key={label} className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                  <p className="text-[10px] font-medium text-vega-text-muted">{label}</p>
                  <p className="mt-1 text-xl font-semibold leading-6 text-vega-text">{value}</p>
                  <p className="mt-1 text-[10px] leading-4 text-vega-text-dim">{helper}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {quickActions.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex min-h-12 items-center justify-between gap-3 border-b border-vega-border-soft py-2.5 transition-colors last:border-b-0 hover:text-vega-text"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-vega-text">{item.label}</span>
                    <span className="mt-0.5 block truncate text-[10px] leading-4 text-vega-text-muted">{item.helper}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-vega-text-dim transition-colors group-hover:text-vega-purple" strokeWidth={1.8} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Priorities</CardTitle>
            <CardDescription>Attention queue for the current operating day.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {priorities.map((item, index) => (
              <div key={item.title} className="flex min-h-[54px] gap-3 border-b border-vega-border-soft py-2.5 last:border-b-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-vega-border bg-vega-surface-2 font-mono text-[10px] font-semibold text-vega-text-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-vega-text">{item.title}</p>
                    <Badge variant={item.variant}>{item.state}</Badge>
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-vega-text-muted">{item.context}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>Latest CRM actions from your team.</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.recentActivity.length === 0 ? (
            <div className="flex min-h-20 items-center gap-3 rounded-md border border-dashed border-vega-border bg-vega-surface-2 p-4 text-xs text-vega-text-muted">
              <ListChecks className="h-4 w-4 text-vega-text-dim" strokeWidth={1.8} aria-hidden="true" />
              <p>No activity yet. New lead, proposal, scope and task events will appear here.</p>
            </div>
          ) : (
            <div className="relative space-y-0">
              <div className="absolute bottom-3 left-[15px] top-3 w-px bg-vega-border-soft" aria-hidden="true" />
              {metrics.recentActivity.slice(0, 8).map((item) => (
                <div key={item._id} className="relative grid min-h-[54px] grid-cols-[31px_minmax(0,1fr)_auto] items-center gap-3 border-b border-vega-border-soft py-2.5 last:border-b-0">
                  <span className="z-10 h-[7px] w-[7px] justify-self-center rounded-full bg-vega-purple ring-4 ring-vega-surface-1" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-vega-text">
                      {item.action.replaceAll("_", " ")}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] leading-4 capitalize text-vega-text-muted">
                      Related {item.entityType.replaceAll("_", " ")}
                    </p>
                  </div>
                  <time className="hidden text-[10px] leading-4 text-vega-text-dim sm:block">
                    {new Date(item.createdAt).toLocaleString("en-IN")}
                  </time>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

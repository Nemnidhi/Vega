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

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const metrics = (await getDashboardMetrics()) as {
    totalLeads: number;
    heavyArtilleryLeads: number;
    standardPipelineLeads: number;
    volumePipelineLeads: number;
    closedWonLeads: number;
    openChangeOrders: number;
    recentActivity: Array<{
      _id: string;
      action: string;
      entityType: string;
      createdAt: string;
    }>;
  };

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
      helperText: "Converted leads with scope + proposal lock.",
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
      title: "Open Change Orders",
      value: String(metrics.openChangeOrders),
      helperText: "Pending out-of-scope protection items.",
      trend: metrics.openChangeOrders > 0 ? ("down" as const) : ("neutral" as const),
    },
  ];

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Strategic Operations Dashboard"
        subtitle="Command center for lead filtration, scope lock, proposals, pricing, and audit protection."
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
            <CardTitle>Final Integration Rules</CardTitle>
            <CardDescription>
              Enforcement logic active across API workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. No Closed Won without completed scope + signed proposal</p>
            <p>2. No engineering start before scope lock and signed mandate</p>
            <p>3. High-ticket leads flagged immediately via scoring</p>
            <p>4. Pricing applies margin protection by default</p>
            <p>5. Sensitive actions are activity-logged</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Audit Activity</CardTitle>
            <CardDescription>
              Lead, proposal, scope, pricing, and change-order events.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {metrics.recentActivity.length === 0 ? (
              <p>No activity yet.</p>
            ) : (
              metrics.recentActivity.map((item) => (
                <p key={item._id}>
                  {item.action} on {item.entityType} •{" "}
                  {new Date(item.createdAt).toLocaleString("en-IN")}
                </p>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

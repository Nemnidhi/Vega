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
  await requireRoleAccess(["admin", "sales"], { redirectTo: "/projects" });

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
  ];

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="CRM Overview"
        subtitle="Quick summary of leads, conversions, and pending actions."
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
            <CardTitle>CRM Rules</CardTitle>
            <CardDescription>
              Basic checks used across lead workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Keep lead details complete and accurate.</p>
            <p>2. Update lead status regularly.</p>
            <p>3. Prioritize high-intent leads first.</p>
            <p>4. Keep notes clear for team handoff.</p>
            <p>5. Sensitive actions are activity-logged.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Audit Activity</CardTitle>
            <CardDescription>
              Lead-related events.
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

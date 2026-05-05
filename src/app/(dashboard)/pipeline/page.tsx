import { DashboardHeader } from "@/components/dashboard/header";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPipelineBoard } from "@/lib/dashboard/queries";
import { requireRoleAccess } from "@/lib/auth/role-access";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  await requireRoleAccess(["admin", "sales"], { redirectTo: "/projects" });

  const stages = (await getPipelineBoard()) as Array<{
    stage: string;
    leads: Array<{
      _id: string;
      title: string;
      contactName: string;
      priorityBand: string;
      score: number;
    }>;
  }>;
  const totalLeads = stages.reduce((sum, stage) => sum + stage.leads.length, 0);

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Pipeline"
        subtitle="Track lead stages from new to closed."
      />

      <Card>
        <CardHeader>
          <CardTitle>Lead Scoring ({totalLeads})</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          <p className="rounded-xl border border-border bg-white/70 px-3 py-2 text-sm text-muted-foreground">
            80+ = High Priority
          </p>
          <p className="rounded-xl border border-border bg-white/70 px-3 py-2 text-sm text-muted-foreground">
            50-79 = Standard Pipeline
          </p>
          <p className="rounded-xl border border-border bg-white/70 px-3 py-2 text-sm text-muted-foreground">
            Below 50 = Volume Pipeline
          </p>
        </CardContent>
      </Card>

      <KanbanBoard stages={stages} />
    </section>
  );
}

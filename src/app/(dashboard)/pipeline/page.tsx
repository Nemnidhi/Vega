import { DashboardHeader } from "@/components/dashboard/header";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPipelineBoard } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
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

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Pipeline Theater"
        subtitle="Kanban pipeline with priority-driven lead filtration."
      />

      <Card>
        <CardHeader>
          <CardTitle>Silent Lead Scoring Bands</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
          <p>80+ = Heavy Artillery / Partner Negotiation</p>
          <p>50-79 = Standard Sales Pipeline</p>
          <p>Below 50 = Volume Pipeline</p>
        </CardContent>
      </Card>

      <KanbanBoard stages={stages} />
    </section>
  );
}

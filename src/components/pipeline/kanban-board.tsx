import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PipelineStage = {
  stage: string;
  leads: Array<{
    _id: string;
    title: string;
    contactName: string;
    priorityBand: string;
    score: number;
  }>;
};

function stageTitle(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function priorityVariant(priorityBand: string): "danger" | "warning" | "accent" | "neutral" {
  if (priorityBand === "heavy_artillery") return "danger";
  if (priorityBand === "standard_sales") return "warning";
  if (priorityBand === "volume_pipeline") return "accent";
  return "neutral";
}

export function KanbanBoard({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-4 2xl:grid-cols-7">
      {stages.map((stage) => (
        <Card key={stage.stage}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">{stageTitle(stage.stage)}</CardTitle>
              <Badge variant="neutral">{stage.leads.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {stage.leads.length === 0 ? (
              <p className="text-xs text-muted-foreground">No leads</p>
            ) : (
              stage.leads.map((lead) => (
                <Link
                  key={lead._id}
                  href={`/leads/${lead._id}`}
                  className="block rounded-lg border border-border bg-white p-2 text-xs hover:bg-surface-soft"
                >
                  <p className="font-semibold text-foreground">{lead.title}</p>
                  <p className="mt-0.5 text-muted-foreground">{lead.contactName}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge variant={priorityVariant(lead.priorityBand)}>
                      {lead.priorityBand.replaceAll("_", " ")}
                    </Badge>
                    <span className="font-mono text-muted-foreground">{lead.score ?? 0}</span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

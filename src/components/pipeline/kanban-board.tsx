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
    <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
      <div className="mb-3 px-2 text-xs text-muted-foreground">
        Scroll horizontally on smaller screens to see all stages.
      </div>
      <div className="no-scrollbar overflow-x-auto pb-2">
        <div className="grid min-w-[1220px] grid-flow-col auto-cols-[minmax(240px,1fr)] gap-4">
          {stages.map((stage) => (
            <Card key={stage.stage} className="min-h-[360px]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">{stageTitle(stage.stage)}</CardTitle>
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-border bg-white px-2 text-xs font-semibold text-foreground">
                    {stage.leads.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {stage.leads.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-surface-soft/65 px-3 py-7 text-center text-xs text-muted-foreground">
                    No leads
                  </div>
                ) : (
                  stage.leads.map((lead) => (
                    <Link
                      key={lead._id}
                      href={`/leads/${lead._id}`}
                      className="group block rounded-lg border border-border bg-white p-3 text-xs transition-colors duration-150 hover:bg-surface-soft"
                    >
                      <p className="text-sm font-semibold leading-5 text-foreground break-words">
                        {lead.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground break-words">
                        {lead.contactName}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Badge variant={priorityVariant(lead.priorityBand)}>
                          {lead.priorityBand.replaceAll("_", " ")}
                        </Badge>
                        <span className="inline-flex min-w-[44px] items-center justify-center rounded-full border border-border bg-white px-2 py-1 font-mono text-[11px] text-muted-foreground">
                          {lead.score ?? 0}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { ScopeManifestForm } from "@/components/scope/scope-manifest-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeadById, getScopeByLeadId } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

type Params = Promise<{ leadId: string }>;

export default async function ScopeLeadPage({ params }: { params: Params }) {
  const { leadId } = await params;
  const [lead, scope] = await Promise.all([getLeadById(leadId), getScopeByLeadId(leadId)]);

  if (!lead) {
    notFound();
  }

  const leadData = lead as {
    _id: string;
    title: string;
    status: string;
    score: number;
    priorityBand: string;
  };
  const scopeData = scope as Record<string, unknown> | null;

  return (
    <section className="space-y-6">
      <DashboardHeader
        title={`Scope Manifest for ${leadData.title}`}
        subtitle="Scope completion is mandatory before Closed Won."
      />

      <Card>
        <CardHeader>
          <CardTitle>Lead Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="neutral">Status: {leadData.status}</Badge>
          <Badge variant="accent">Score: {leadData.score ?? 0}</Badge>
          <Badge variant="warning">
            {leadData.priorityBand?.replaceAll("_", " ") ?? "volume pipeline"}
          </Badge>
        </CardContent>
      </Card>

      <ScopeManifestForm leadId={leadId} initialData={scopeData} />
    </section>
  );
}

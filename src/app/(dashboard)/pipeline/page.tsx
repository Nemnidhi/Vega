import { DashboardHeader } from "@/components/dashboard/header";
import { PipelineLeadList } from "@/components/pipeline/pipeline-lead-list";
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

  const pipelineLeads = stages.flatMap((stage) =>
    stage.leads.map((lead) => ({
      ...lead,
      stage: stage.stage,
    })),
  );

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Pipeline"
        subtitle="Track lead stages from new to closed."
      />

      <PipelineLeadList leads={pipelineLeads} />
    </section>
  );
}

import { DashboardHeader } from "@/components/dashboard/header";
import { PipelineLeadList } from "@/components/pipeline/pipeline-lead-list";
import { getPipelineBoard } from "@/lib/dashboard/queries";
import { requireRoleAccess } from "@/lib/auth/role-access";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  await requireRoleAccess(["admin", "sales", "digital_marketing"], {
    redirectTo: "/projects",
  });

  const stages = (await getPipelineBoard({ limitPerStage: 80 })) as Array<{
    stage: string;
    leads: Array<{
      _id: string;
      title: string;
      contactName: string;
      status: string;
      priorityBand: string;
      score: number;
    }>;
  }>;

  const pipelineLeads = stages.flatMap((stage) =>
    stage.leads.map((lead) => ({
      ...lead,
      stage: lead.status ?? stage.stage,
    })),
  );

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Pipeline"
        subtitle="Track lead stages from new to closed. Showing latest 80 leads per stage for faster loading."
      />

      <PipelineLeadList leads={pipelineLeads} />
    </section>
  );
}

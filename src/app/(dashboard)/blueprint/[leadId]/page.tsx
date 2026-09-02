import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { BlueprintEditor } from "@/components/blueprint/blueprint-editor";
import { connectToDatabase } from "@/lib/db/mongodb";
import { BlueprintModel, LeadModel } from "@/models";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { permissionRules } from "@/lib/auth/permissions";
import { serializeForJson } from "@/lib/utils/serialize";
import { buildQuestionnaire } from "@/lib/blueprint/questionnaire";
import type { Lead } from "@/types/lead";

export const dynamic = "force-dynamic";

type Params = Promise<{ leadId: string }>;

export default async function BlueprintPage({ params }: { params: Params }) {
  await requireRoleAccess(permissionRules.manageLeads);

  const { leadId } = await params;
  await connectToDatabase();

  const lead = await LeadModel.findById(leadId)
    .select("title prospecting")
    .lean<Pick<Lead, "_id" | "title" | "prospecting"> | null>();
  if (!lead) {
    notFound();
  }

  const blueprintDoc = await BlueprintModel.findOne({ leadId, status: { $ne: "superseded" } })
    .sort({ version: -1 })
    .lean();

  const industry = lead.prospecting?.industry ?? null;
  const segment = lead.prospecting?.segment ?? null;
  const questions = buildQuestionnaire(industry, { segment });

  return (
    <section className="space-y-6">
      <DashboardHeader
        title={`Blueprint - ${lead.title}`}
        subtitle="Requirements call, recommended components, and estimate range."
        showLeadCta={false}
        action={{ label: "Back To Lead", href: `/leads/${leadId}` }}
      />

      <BlueprintEditor
        leadId={leadId}
        questions={questions}
        initialBlueprint={blueprintDoc ? serializeForJson(blueprintDoc) : null}
      />
    </section>
  );
}

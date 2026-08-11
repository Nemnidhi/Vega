import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { ScopeManifestForm } from "@/components/scope/scope-manifest-form";
import { connectToDatabase } from "@/lib/db/mongodb";
import { BlueprintModel, ClientModel, LeadModel, ScopeManifestModel } from "@/models";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { permissionRules } from "@/lib/auth/permissions";
import { serializeForJson } from "@/lib/utils/serialize";
import type { BlueprintDocument } from "@/models/Blueprint";

export const dynamic = "force-dynamic";

type Params = Promise<{ leadId: string }>;

export default async function ScopeLeadPage({ params }: { params: Params }) {
  await requireRoleAccess(permissionRules.manageScope);

  const { leadId } = await params;
  await connectToDatabase();

  const lead = await LeadModel.findById(leadId).select("title email").lean();
  if (!lead) {
    notFound();
  }

  const existingManifest = await ScopeManifestModel.findOne({ leadId }).lean();

  let initialData: Record<string, unknown> | null = existingManifest
    ? (serializeForJson(existingManifest) as Record<string, unknown>)
    : null;

  // Convenience prefill only, and only when nothing has been saved yet -
  // staff still reviews/edits/completes/signs manually either way.
  if (!initialData) {
    const approvedBlueprint = await BlueprintModel.findOne({ leadId, status: "approved" })
      .sort({ version: -1 })
      .lean<BlueprintDocument | null>();

    if (approvedBlueprint) {
      const client =
        (await ClientModel.findOne({ leadId }).select("_id").lean()) ??
        (lead.email
          ? await ClientModel.findOne({ primaryContactEmail: lead.email.toLowerCase().trim() })
              .select("_id")
              .lean()
          : null);

      const confirmedDeliverables = approvedBlueprint.components.flatMap((c) => [
        c.title,
        ...c.features.map((f) => f.label),
      ]);

      initialData = {
        clientId: client ? String(client._id) : "",
        confirmedDeliverables,
      };
    }
  }

  return (
    <section className="space-y-6">
      <DashboardHeader
        title={`Scope-Lock - ${lead.title}`}
        subtitle="Finalize and sign the confirmed scope before work begins."
        showLeadCta={false}
        action={{ label: "Back To Lead", href: `/leads/${leadId}` }}
      />

      <ScopeManifestForm leadId={leadId} initialData={initialData} />
    </section>
  );
}

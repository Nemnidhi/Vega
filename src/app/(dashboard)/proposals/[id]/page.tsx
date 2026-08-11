import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { ProposalGeneratorForm } from "@/components/proposals/proposal-generator-form";
import { ProposalStatusSelect } from "@/components/proposals/proposal-status-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { connectToDatabase } from "@/lib/db/mongodb";
import { BlueprintModel, LeadModel, ProposalModel, ScopeManifestModel } from "@/models";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { permissionRules } from "@/lib/auth/permissions";
import { serializeForJson } from "@/lib/utils/serialize";
import type { BlueprintDocument } from "@/models/Blueprint";

export const dynamic = "force-dynamic";

// Folder is [id] (not [leadId]) to match the pre-existing sibling dead stub
// this replaces - Next.js requires sibling dynamic segments to share one
// param name. The id here is the lead's id, same as /blueprint/[leadId] and
// /scope/[leadId] conceptually, just named to fit this route tree.
type Params = Promise<{ id: string }>;

function proposalStatusVariant(status: string): "success" | "warning" | "danger" | "neutral" | "accent" {
  if (status === "signed") return "success";
  if (status === "rejected") return "danger";
  if (status === "sent" || status === "viewed") return "accent";
  return "neutral";
}

export default async function ProposalsLeadPage({ params }: { params: Params }) {
  await requireRoleAccess(permissionRules.manageProposals);

  const { id: leadId } = await params;
  await connectToDatabase();

  const lead = await LeadModel.findById(leadId).select("title").lean();
  if (!lead) {
    notFound();
  }

  const scopeManifest = await ScopeManifestModel.findOne({
    leadId,
    isCompleted: true,
    signedAt: { $ne: null },
  }).lean();

  const existingProposals = await ProposalModel.find({ leadId })
    .sort({ version: -1 })
    .lean();

  if (!scopeManifest) {
    return (
      <section className="space-y-6">
        <DashboardHeader
          title={`Proposal - ${lead.title}`}
          subtitle="A proposal can only be generated from a signed Scope Manifest."
          showLeadCta={false}
          action={{ label: "Back To Lead", href: `/leads/${leadId}` }}
        />
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              This lead has no signed Scope Manifest yet - a proposal must never assert deliverables
              and pricing nobody has agreed to.
            </p>
            <a
              href={`/scope/${leadId}`}
              className="mt-3 inline-flex h-11 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-soft"
            >
              Go To Scope-Lock
            </a>
          </CardContent>
        </Card>
      </section>
    );
  }

  const approvedBlueprint = await BlueprintModel.findOne({ leadId, status: "approved" })
    .sort({ version: -1 })
    .lean<BlueprintDocument | null>();

  const initialData: Record<string, unknown> = {
    projectSummary: scopeManifest.businessObjective,
    scopeOfWork: scopeManifest.confirmedDeliverables,
    exclusions: scopeManifest.exclusions,
    timeline: scopeManifest.timelineAssumptions.join("; "),
    changeOrderClause: scopeManifest.changeOrderRules,
    paymentSchedule: scopeManifest.paymentMilestones.map((m: { heading: string }) => ({
      label: m.heading,
      amount: 0,
    })),
    pricing: approvedBlueprint
      ? approvedBlueprint.components.map((c) => ({
          label: c.title,
          amount: c.oneTimePrice,
          quantity: 1,
        }))
      : [],
  };

  return (
    <section className="space-y-6">
      <DashboardHeader
        title={`Proposal - ${lead.title}`}
        subtitle="Generate a formal proposal from the signed scope, and track it through to a signature."
        showLeadCta={false}
        action={{ label: "Back To Lead", href: `/leads/${leadId}` }}
      />

      {existingProposals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Proposal Versions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {serializeForJson(existingProposals).map((p: Record<string, unknown>) => (
              <div
                key={String(p._id)}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={proposalStatusVariant(String(p.status))}>
                    v{String(p.version)} - {String(p.status)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Approval: {String(p.approvalStatus)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={`/api/proposals/${p._id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-accent hover:underline"
                  >
                    View
                  </a>
                  <ProposalStatusSelect proposalId={String(p._id)} currentStatus={String(p.status)} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Scope Reference</CardTitle>
          <CardDescription>
            Prefilled from the signed Scope Manifest{approvedBlueprint ? " and the approved Blueprint's pricing" : ""}
            - review before generating.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProposalGeneratorForm
            leadId={leadId}
            clientId={String(scopeManifest.clientId)}
            scopeManifestId={String(scopeManifest._id)}
            initialData={initialData}
          />
        </CardContent>
      </Card>
    </section>
  );
}

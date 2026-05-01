import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/header";
import { ProposalGeneratorForm } from "@/components/proposals/proposal-generator-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProposals } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

function approvalVariant(value: string): "success" | "warning" | "danger" | "neutral" {
  if (value === "approved") return "success";
  if (value === "pending") return "warning";
  if (value === "rejected") return "danger";
  return "neutral";
}

export default async function ProposalsPage() {
  const proposals = (await getProposals()) as Array<{
    _id: string;
    version: number;
    status: string;
    approvalStatus: string;
    leadId?: { title?: string };
    clientId?: { legalName?: string };
  }>;

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Mandate Engine"
        subtitle="Generate strategic proposals, track statuses, and produce PDF-ready outputs."
      />

      <ProposalGeneratorForm />

      <Card>
        <CardHeader>
          <CardTitle>Proposal Registry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {proposals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No proposals generated yet.</p>
          ) : (
            proposals.map((proposal) => (
              <div
                key={proposal._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white p-3"
              >
                <div>
                  <p className="font-semibold">
                    {proposal.leadId?.title ?? "Untitled Lead"} (v{proposal.version})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {proposal.clientId?.legalName ?? "Unknown Client"} • {proposal.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={approvalVariant(proposal.approvalStatus)}>
                    {proposal.approvalStatus}
                  </Badge>
                  <Link href={`/proposals/${proposal._id}`} className="text-sm text-accent hover:underline">
                    Open
                  </Link>
                  <a
                    href={`/api/proposals/${proposal._id}/pdf`}
                    className="text-sm text-accent hover:underline"
                  >
                    PDF-ready
                  </a>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}

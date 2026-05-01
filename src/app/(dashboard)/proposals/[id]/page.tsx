import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { ProposalStatusSelect } from "@/components/proposals/proposal-status-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProposalById } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

function formatCurrency(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function ProposalDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const proposal = await getProposalById(id);
  if (!proposal) {
    notFound();
  }

  const record = proposal as {
    _id: string;
    status: string;
    approvalStatus: string;
    projectSummary: string;
    timeline: string;
    scopeOfWork: string[];
    exclusions: string[];
    pricing: Array<{ label: string; amount: number; quantity: number; currency: string }>;
    paymentSchedule: Array<{ label: string; amount: number; currency: string }>;
    changeOrderClause: string;
    signatureBlock: string;
    leadId?: { title?: string };
    clientId?: { legalName?: string };
  };

  const total = record.pricing.reduce((sum, line) => sum + line.amount * line.quantity, 0);

  return (
    <section className="space-y-6">
      <DashboardHeader
        title={`Proposal ${record._id}`}
        subtitle={`${record.leadId?.title ?? "Lead"} • ${record.clientId?.legalName ?? "Client"}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Status Controls</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p>Status: {record.status}</p>
            <p>Approval: {record.approvalStatus}</p>
          </div>
          <div className="flex items-center gap-3">
            <ProposalStatusSelect proposalId={record._id} currentStatus={record.status} />
            <a
              href={`/api/proposals/${record._id}/pdf`}
              className="text-sm font-medium text-accent hover:underline"
            >
              Open PDF-ready output
            </a>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{record.projectSummary}</p>
            <p className="text-muted-foreground">Timeline: {record.timeline}</p>
            <p className="font-medium">Scope of Work</p>
            <ul className="list-disc pl-5">
              {record.scopeOfWork.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="font-medium">Exclusions</p>
            <ul className="list-disc pl-5">
              {record.exclusions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing & Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-surface-soft p-3">
              {record.pricing.map((line) => (
                <p key={`${line.label}-${line.amount}`}>
                  {line.label} ({line.quantity} x {formatCurrency(line.amount, line.currency)}) ={" "}
                  {formatCurrency(line.amount * line.quantity, line.currency)}
                </p>
              ))}
              <p className="mt-2 font-semibold">Total: {formatCurrency(total)}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-soft p-3">
              {record.paymentSchedule.map((item) => (
                <p key={`${item.label}-${item.amount}`}>
                  {item.label}: {formatCurrency(item.amount, item.currency)}
                </p>
              ))}
            </div>
            <p>
              <span className="font-medium">Change Order Clause:</span>{" "}
              {record.changeOrderClause}
            </p>
            <p>
              <span className="font-medium">Signature Block:</span> {record.signatureBlock}
            </p>
            <Link href="/proposals" className="text-accent hover:underline">
              Back to proposals
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

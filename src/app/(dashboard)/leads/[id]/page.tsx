import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { connectToDatabase } from "@/lib/db/mongodb";
import { LeadModel, ProposalModel, ScopeManifestModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export const dynamic = "force-dynamic";

function priorityVariant(priorityBand: string): "danger" | "warning" | "accent" | "neutral" {
  if (priorityBand === "heavy_artillery") return "danger";
  if (priorityBand === "standard_sales") return "warning";
  if (priorityBand === "volume_pipeline") return "accent";
  return "neutral";
}

type Params = Promise<{ id: string }>;

export default async function LeadDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  await connectToDatabase();

  const [leadDoc, scopeDoc, signedProposalCount, proposals] = await Promise.all([
    LeadModel.findById(id)
      .select(
        "title contactName email phone source category urgency score priorityBand priorityFlag status description budget",
      )
      .lean(),
    ScopeManifestModel.findOne({ leadId: id }).select("isCompleted signedAt").lean(),
    ProposalModel.countDocuments({ leadId: id, status: "signed" }),
    ProposalModel.find({ leadId: id })
      .sort({ updatedAt: -1 })
      .select("version status approvalStatus")
      .lean(),
  ]);

  if (!leadDoc) {
    notFound();
  }

  const lead = serializeForJson(leadDoc) as {
    _id: string;
    title: string;
    contactName: string;
    email: string;
    phone?: string;
    source: string;
    category: string;
    urgency: string;
    score: number;
    priorityBand: string;
    priorityFlag: boolean;
    status: string;
    description: string;
    budget?: { min: number; max: number; currency: string };
  };

  const scope = serializeForJson(scopeDoc) as {
    _id: string;
    isCompleted: boolean;
    signedAt?: string | null;
  } | null;
  const proposalItems = serializeForJson(proposals) as Array<{
    _id: string;
    version: number;
    status: string;
    approvalStatus: string;
  }>;

  const scopeReady = Boolean(scope?.isCompleted && scope?.signedAt);
  const proposalReady = signedProposalCount > 0;

  return (
    <section className="space-y-6">
      <DashboardHeader
        title={lead.title}
        subtitle="Lead detail page with scoring, scope-lock state, and proposal readiness."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lead Profile</CardTitle>
            <CardDescription>{lead.contactName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Email:</span> {lead.email}
            </p>
            {lead.phone ? (
              <p>
                <span className="text-muted-foreground">Phone:</span> {lead.phone}
              </p>
            ) : null}
            <p>
              <span className="text-muted-foreground">Source:</span>{" "}
              {lead.source.replaceAll("_", " ")}
            </p>
            <p>
              <span className="text-muted-foreground">Category:</span>{" "}
              {lead.category.replaceAll("_", " ")}
            </p>
            <p>
              <span className="text-muted-foreground">Urgency:</span> {lead.urgency}
            </p>
            <p>
              <span className="text-muted-foreground">Description:</span> {lead.description}
            </p>
            {lead.budget ? (
              <p>
                <span className="text-muted-foreground">Budget:</span> {lead.budget.currency}{" "}
                {lead.budget.min.toLocaleString()} - {lead.budget.max.toLocaleString()}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Silent Lead Scoring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold">{lead.score ?? 0}</p>
            <Badge variant={priorityVariant(lead.priorityBand)}>
              {lead.priorityBand.replaceAll("_", " ")}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {lead.priorityFlag
                ? "High-ticket lead: partner negotiation priority."
                : "Standard pipeline handling applies."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scope-Lock Readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Scope manifest completed: {scopeReady ? "Yes" : "No"}</p>
            <p>Signed proposal available: {proposalReady ? "Yes" : "No"}</p>
            <p className="text-muted-foreground">
              Closed Won is blocked until both checks are complete.
            </p>
            <Link href={`/scope/${lead._id}`} className="text-accent hover:underline">
              Open Scope Manifest
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proposals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {proposalItems.length === 0 ? (
              <p className="text-muted-foreground">No proposal yet.</p>
            ) : (
              proposalItems.map((proposal) => (
                <p key={proposal._id}>
                  v{proposal.version} - {proposal.status} ({proposal.approvalStatus}){" "}
                  <Link
                    href={`/proposals/${proposal._id}`}
                    className="ml-1 text-accent hover:underline"
                  >
                    view
                  </Link>
                </p>
              ))
            )}
            <Link href="/proposals" className="text-accent hover:underline">
              Create or manage proposals
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

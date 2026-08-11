import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { ClientAuditSummary } from "@/components/client/client-audit-summary";
import { ClientBlueprintView } from "@/components/client/client-blueprint-view";
import { ClientProposalView } from "@/components/client/client-proposal-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { connectToDatabase } from "@/lib/db/mongodb";
import { BlueprintModel, LeadModel, ProposalModel } from "@/models";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { resolveClientLeadId } from "@/lib/auth/client-lead";
import { serializeForJson } from "@/lib/utils/serialize";
import type { Lead } from "@/types/lead";

export const dynamic = "force-dynamic";

export default async function ClientLeadHomePage() {
  const session = await requireRoleAccess(["client"], {
    loginPath: "/client/login",
    redirectTo: "/dashboard",
  });

  const leadId = await resolveClientLeadId(session);
  if (!leadId) {
    redirect("/client/queries");
  }

  await connectToDatabase();
  const lead = await LeadModel.findById(leadId)
    .select("title prospecting")
    .lean<Pick<Lead, "_id" | "title" | "prospecting"> | null>();
  if (!lead) {
    redirect("/client/queries");
  }

  const blueprintDoc = await BlueprintModel.findOne({ leadId, status: { $ne: "superseded" } })
    .sort({ version: -1 })
    .lean();

  const proposalDoc = await ProposalModel.findOne({ leadId }).sort({ version: -1 }).lean();

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-4 p-3 sm:space-y-6 sm:p-4 md:p-7 lg:p-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{lead.title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Signed in as {session.fullName ?? session.email}
              </p>
            </div>
            <LogoutButton redirectTo="/client/login" className="w-full sm:w-auto" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your digital-presence audit and project requirements, in one place.
          </p>
        </CardContent>
      </Card>

      <ClientAuditSummary
        leadId={leadId}
        prospecting={lead.prospecting as unknown as Parameters<typeof ClientAuditSummary>[0]["prospecting"]}
      />

      <ClientBlueprintView
        leadId={leadId}
        initialBlueprint={blueprintDoc ? serializeForJson(blueprintDoc) : null}
      />

      <ClientProposalView
        initialProposal={proposalDoc ? serializeForJson(proposalDoc) : null}
      />
    </main>
  );
}

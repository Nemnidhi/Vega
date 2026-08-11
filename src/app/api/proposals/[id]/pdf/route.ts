import { connectToDatabase } from "@/lib/db/mongodb";
import { handleApiError } from "@/lib/api/responses";
import { ProposalModel, ClientModel, LeadModel, ScopeManifestModel } from "@/models";
import { buildProposalHtml } from "@/lib/proposals/pdf-template";
import { serializeForJson } from "@/lib/utils/serialize";
import { getCurrentSession } from "@/lib/auth/session";
import { assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { resolveClientLeadId } from "@/lib/auth/client-lead";
import { logActivity } from "@/lib/activity/logging";
import type { Client, Lead, Proposal, ScopeManifest } from "@/types";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const proposalDoc = await ProposalModel.findById(id);
    if (!proposalDoc) {
      throw new Error("Proposal not found");
    }

    const session = await getCurrentSession();
    if (!session) throw new Error("Unauthorized");

    const isClient = session.role === "client";
    if (isClient) {
      const clientLeadId = await resolveClientLeadId(session);
      if (!clientLeadId || clientLeadId !== String(proposalDoc.leadId)) {
        throw new Error("Forbidden");
      }
    } else {
      assertRoleAccess(session.role, { oneOf: permissionRules.manageProposals });
    }

    if (isClient && proposalDoc.status === "sent") {
      proposalDoc.status = "viewed";
      proposalDoc.viewedAt = new Date();
      await proposalDoc.save();

      const forwardedFor = request.headers.get("x-forwarded-for");
      await logActivity({
        action: "proposal_viewed",
        actorId: session.userId,
        entityType: "proposal",
        entityId: String(proposalDoc._id),
        details: {},
        ipAddress: forwardedFor ? forwardedFor.split(",")[0]?.trim() : undefined,
      });
    }

    const [leadDoc, clientDoc, scopeDoc] = await Promise.all([
      LeadModel.findById(proposalDoc.leadId).lean(),
      ClientModel.findById(proposalDoc.clientId).lean(),
      ScopeManifestModel.findById(proposalDoc.scopeManifestId).lean(),
    ]);

    if (!leadDoc || !clientDoc || !scopeDoc) {
      throw new Error("Proposal dependencies are incomplete");
    }

    const proposal = serializeForJson(proposalDoc) as Proposal;
    const lead = serializeForJson(leadDoc) as Lead;
    const client = serializeForJson(clientDoc) as Client;
    const scopeManifest = serializeForJson(scopeDoc) as ScopeManifest;

    const html = buildProposalHtml({ proposal, lead, client, scopeManifest });

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename=proposal-${id}.html`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

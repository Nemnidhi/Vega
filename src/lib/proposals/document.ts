// Shared by the cookie-session route (src/app/api/proposals/[id]/pdf/route.ts) and
// the shared-secret /api/client-portal/proposal-document/[id] route the website calls.
//
// Despite the "pdf" name on the existing route/URL, this renders and returns HTML
// (buildProposalHtml), not a real PDF - kept as-is here since that's genuinely what
// the existing route does; the new client-portal route is named "proposal-document"
// instead of "proposal-pdf" so the misnomer isn't repeated in a second codebase.

import { ProposalModel, ClientModel, LeadModel, ScopeManifestModel } from "@/models";
import { buildProposalHtml } from "@/lib/proposals/pdf-template";
import { serializeForJson } from "@/lib/utils/serialize";
import type { AuthSession } from "@/lib/auth/session";
import { resolveClientLeadId } from "@/lib/auth/client-lead";
import { logActivity } from "@/lib/activity/logging";
import { ApiError } from "@/lib/api/responses";
import type { Client, Lead, Proposal, ScopeManifest } from "@/types";

/** Fetches the proposal's dependencies and renders the HTML - no auth/ownership checks. */
export async function renderProposalDocumentHtml(proposalDoc: InstanceType<typeof ProposalModel>) {
  const [leadDoc, clientDoc, scopeDoc] = await Promise.all([
    LeadModel.findById(proposalDoc.leadId).lean(),
    ClientModel.findById(proposalDoc.clientId).lean(),
    ScopeManifestModel.findById(proposalDoc.scopeManifestId).lean(),
  ]);

  if (!leadDoc || !clientDoc || !scopeDoc) {
    throw new Error("Proposal dependencies are incomplete");
  }

  return buildProposalHtml({
    proposal: serializeForJson(proposalDoc) as Proposal,
    lead: serializeForJson(leadDoc) as Lead,
    client: serializeForJson(clientDoc) as Client,
    scopeManifest: serializeForJson(scopeDoc) as ScopeManifest,
  });
}

export async function getClientProposalDocumentHtml(
  session: AuthSession,
  proposalId: string,
  requestIp: string | null,
): Promise<string> {
  if (session.role !== "client") throw new Error("Forbidden");

  const proposalDoc = await ProposalModel.findById(proposalId);
  if (!proposalDoc) {
    throw new ApiError("Proposal not found", 404);
  }

  const clientLeadId = await resolveClientLeadId(session);
  if (!clientLeadId || clientLeadId !== String(proposalDoc.leadId)) {
    throw new Error("Forbidden");
  }

  if (proposalDoc.status === "sent") {
    proposalDoc.status = "viewed";
    proposalDoc.viewedAt = new Date();
    await proposalDoc.save();

    await logActivity({
      action: "proposal_viewed",
      actorId: session.userId,
      entityType: "proposal",
      entityId: String(proposalDoc._id),
      details: {},
      ipAddress: requestIp ?? undefined,
    });
  }

  return renderProposalDocumentHtml(proposalDoc);
}

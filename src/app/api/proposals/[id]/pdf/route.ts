import { connectToDatabase } from "@/lib/db/mongodb";
import { handleApiError } from "@/lib/api/responses";
import { ProposalModel, ClientModel, LeadModel, ScopeManifestModel } from "@/models";
import { buildProposalHtml } from "@/lib/proposals/pdf-template";
import { serializeForJson } from "@/lib/utils/serialize";
import type { Client, Lead, Proposal, ScopeManifest } from "@/types";

type Params = Promise<{ id: string }>;

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const proposalDoc = await ProposalModel.findById(id).lean();
    if (!proposalDoc) {
      throw new Error("Proposal not found");
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

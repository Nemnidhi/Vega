import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { draftProposalSchema } from "@/lib/validation/proposal";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { ClientModel, LeadModel, ScopeManifestModel } from "@/models";
import { draftProposalSummary } from "@/lib/proposals/draft";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageProposals });

    const payload = draftProposalSchema.parse(await request.json());

    const scopeManifest = await ScopeManifestModel.findById(payload.scopeManifestId).lean();
    if (!scopeManifest) {
      return fail("Scope manifest not found.", 404);
    }

    const [client, lead] = await Promise.all([
      ClientModel.findById(scopeManifest.clientId).select("legalName").lean(),
      LeadModel.findById(scopeManifest.leadId).select("title").lean(),
    ]);
    if (!client || !lead) {
      return fail("Client or lead for this scope manifest not found.", 404);
    }

    const draft = await draftProposalSummary({
      clientName: client.legalName,
      leadTitle: lead.title,
      businessObjective: scopeManifest.businessObjective,
      confirmedDeliverables: scopeManifest.confirmedDeliverables,
      timelineAssumptions: scopeManifest.timelineAssumptions,
    });

    // exclusions/changeOrderClause aren't drafted here - the proposal page's own initialData
    // already copies those straight from the scope manifest; this endpoint only adds value on
    // the two fields that were a raw business-objective string / semicolon-joined list before.
    return ok({
      projectSummary: draft.projectSummary,
      timeline: draft.timeline,
      source: draft.source,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

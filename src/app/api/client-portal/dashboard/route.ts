// Genuinely new - no existing JSON API for this data exists (it's currently only
// assembled by the server component at src/app/(client)/client/lead/page.tsx, which
// queries Mongo directly). Ports that same query logic for the website's dashboard page.

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret, resolveClientPortalActor } from "@/lib/auth/client-portal-actor";
import { resolveClientLeadId } from "@/lib/auth/client-lead";
import { LeadModel, BlueprintModel, ProposalModel } from "@/models";
import { handleApiError, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET(request: Request) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();

    const clientUserId = new URL(request.url).searchParams.get("clientUserId");
    if (!clientUserId) throw new Error("Unauthorized: missing clientUserId");
    const actor = await resolveClientPortalActor(clientUserId);

    const leadId = await resolveClientLeadId(actor);
    if (!leadId) {
      return ok({ lead: null, blueprint: null, proposal: null });
    }

    const [lead, blueprint, proposal] = await Promise.all([
      LeadModel.findById(leadId).select("title prospecting").lean(),
      BlueprintModel.findOne({ leadId, status: { $ne: "superseded" } }).sort({ version: -1 }).lean(),
      ProposalModel.findOne({ leadId }).sort({ version: -1 }).lean(),
    ]);

    return ok(
      serializeForJson({
        lead,
        blueprint,
        proposal,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// Confirms a self-service client's addon selection on the draft Blueprint created by
// /api/client-portal/questionnaire/submit, and locks in the final estimate. Shape mirrors
// /api/client-portal/blueprint/[leadId]/respond/route.ts - shared-secret auth, clientUserId
// destructured from the body (never trusted as a path param since there's no leadId in this
// URL; finalizeSelfServiceBlueprint resolves the caller's own lead via resolveClientLeadId).

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret, resolveClientPortalActor } from "@/lib/auth/client-portal-actor";
import { finalizeSelfServiceBlueprintSchema } from "@/lib/validation/blueprint";
import { finalizeSelfServiceBlueprint } from "@/lib/blueprint/finalize";
import { handleApiError, ok } from "@/lib/api/responses";

export async function POST(request: Request) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();

    const { clientUserId, ...rest } = await request.json();
    if (!clientUserId) throw new Error("Unauthorized: missing clientUserId");
    const actor = await resolveClientPortalActor(clientUserId);

    const payload = finalizeSelfServiceBlueprintSchema.parse(rest);

    const blueprint = await finalizeSelfServiceBlueprint(actor, payload.selectedComponentCodes);
    return ok(blueprint);
  } catch (error) {
    console.error("client-portal/questionnaire/finalize failed:", error);
    return handleApiError(error);
  }
}

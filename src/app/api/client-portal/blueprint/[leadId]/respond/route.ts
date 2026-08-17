// Shared-secret counterpart to /api/blueprint/[leadId]/respond.

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret, resolveClientPortalActor } from "@/lib/auth/client-portal-actor";
import { respondBlueprintSchema } from "@/lib/validation/blueprint";
import { respondToBlueprint } from "@/lib/blueprint/respond";
import { handleApiError, ok } from "@/lib/api/responses";

type Params = Promise<{ leadId: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();

    const { leadId } = await params;
    const { clientUserId, ...rest } = await request.json();
    if (!clientUserId) throw new Error("Unauthorized: missing clientUserId");
    const actor = await resolveClientPortalActor(clientUserId);

    const payload = respondBlueprintSchema.parse(rest);

    const forwardedFor = request.headers.get("x-forwarded-for");
    const requestIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() ?? null : null;

    const blueprint = await respondToBlueprint(actor, leadId, payload, requestIp);
    return ok(blueprint);
  } catch (error) {
    return handleApiError(error);
  }
}

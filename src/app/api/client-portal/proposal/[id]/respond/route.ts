// Shared-secret counterpart to /api/proposals/[id]/respond.

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret, resolveClientPortalActor } from "@/lib/auth/client-portal-actor";
import { respondProposalSchema } from "@/lib/validation/proposal";
import { respondToProposal } from "@/lib/proposals/respond";
import { handleApiError, ok } from "@/lib/api/responses";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();

    const { id } = await params;
    const { clientUserId, ...rest } = await request.json();
    if (!clientUserId) throw new Error("Unauthorized: missing clientUserId");
    const actor = await resolveClientPortalActor(clientUserId);

    const payload = respondProposalSchema.parse(rest);

    const forwardedFor = request.headers.get("x-forwarded-for");
    const requestIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() ?? null : null;

    const proposal = await respondToProposal(actor, id, payload, requestIp);
    return ok(proposal);
  } catch (error) {
    return handleApiError(error);
  }
}

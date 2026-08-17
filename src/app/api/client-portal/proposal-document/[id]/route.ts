// Shared-secret counterpart to the client branch of /api/proposals/[id]/pdf GET.
// Named "proposal-document" (not "proposal-pdf") because this is genuinely HTML, not a
// PDF, despite the existing route/URL's name - see src/lib/proposals/document.ts.

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret, resolveClientPortalActor } from "@/lib/auth/client-portal-actor";
import { getClientProposalDocumentHtml } from "@/lib/proposals/document";
import { handleApiError } from "@/lib/api/responses";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();

    const { id } = await params;
    const clientUserId = new URL(request.url).searchParams.get("clientUserId");
    if (!clientUserId) throw new Error("Unauthorized: missing clientUserId");
    const actor = await resolveClientPortalActor(clientUserId);

    const forwardedFor = request.headers.get("x-forwarded-for");
    const requestIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() ?? null : null;

    const html = await getClientProposalDocumentHtml(actor, id, requestIp);

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

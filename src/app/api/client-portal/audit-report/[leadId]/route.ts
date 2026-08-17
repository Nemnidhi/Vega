// Shared-secret counterpart to the client branch of /api/leads/[id]/audit-report GET.
// Real binary PDF - the website proxies these bytes straight through.

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret, resolveClientPortalActor } from "@/lib/auth/client-portal-actor";
import { getClientAuditReportPdf } from "@/lib/prospecting/client-audit-report";
import { handleApiError } from "@/lib/api/responses";

type Params = Promise<{ leadId: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();

    const { leadId } = await params;
    const clientUserId = new URL(request.url).searchParams.get("clientUserId");
    if (!clientUserId) throw new Error("Unauthorized: missing clientUserId");
    const actor = await resolveClientPortalActor(clientUserId);

    const pdf = await getClientAuditReportPdf(actor, leadId);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="audit-report-${leadId}.pdf"`,
        "Content-Length": String(pdf.length),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { handleApiError } from "@/lib/api/responses";
import { getCurrentSession } from "@/lib/auth/session";
import { assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { getClientProposalDocumentHtml, renderProposalDocumentHtml } from "@/lib/proposals/document";
import { ProposalModel } from "@/models";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const session = await getCurrentSession();
    if (!session) throw new Error("Unauthorized");

    const forwardedFor = request.headers.get("x-forwarded-for");
    const requestIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() ?? null : null;

    let html: string;
    if (session.role === "client") {
      html = await getClientProposalDocumentHtml(session, id, requestIp);
    } else {
      // Staff path - not a client's own document, so the ownership check
      // getClientProposalDocumentHtml does doesn't apply; render directly.
      assertRoleAccess(session.role, { oneOf: permissionRules.manageProposals });

      const proposalDoc = await ProposalModel.findById(id);
      if (!proposalDoc) throw new Error("Proposal not found");

      html = await renderProposalDocumentHtml(proposalDoc);
    }

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

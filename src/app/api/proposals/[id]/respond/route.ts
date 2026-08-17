// Client-side response to a Proposal - unlike the Scope Manifest, a client
// can sign a Proposal directly here. High-ticket leads still need internal
// approval: the signature is real and recorded, but approvalStatus stays
// "pending" until a partner/admin clears it via the existing staff PATCH
// route on /api/proposals/[id] (which already flips approvalStatus to
// "approved" when an admin/partner sets status:"signed").

import { connectToDatabase } from "@/lib/db/mongodb";
import { getCurrentSession } from "@/lib/auth/session";
import { respondProposalSchema } from "@/lib/validation/proposal";
import { respondToProposal } from "@/lib/proposals/respond";
import { handleApiError, ok } from "@/lib/api/responses";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const session = await getCurrentSession();
    if (!session) throw new Error("Unauthorized");

    const { id } = await params;
    const payload = respondProposalSchema.parse(await request.json());

    const forwardedFor = request.headers.get("x-forwarded-for");
    const requestIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() ?? null : null;

    const proposal = await respondToProposal(session, id, payload, requestIp);
    return ok(proposal);
  } catch (error) {
    return handleApiError(error);
  }
}

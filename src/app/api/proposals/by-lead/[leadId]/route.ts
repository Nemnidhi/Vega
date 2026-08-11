// Lead-keyed proposal lookup, matching how Blueprint and the audit report
// are already reached by leadId rather than an opaque document id - the
// client doesn't and shouldn't need to know a proposal's own _id.

import { connectToDatabase } from "@/lib/db/mongodb";
import { ProposalModel } from "@/models";
import { getCurrentSession } from "@/lib/auth/session";
import { assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { resolveClientLeadId } from "@/lib/auth/client-lead";
import { handleApiError, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ leadId: string }>;

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const { leadId } = await params;

    const session = await getCurrentSession();
    if (!session) throw new Error("Unauthorized");

    if (session.role === "client") {
      const clientLeadId = await resolveClientLeadId(session);
      if (!clientLeadId || clientLeadId !== leadId) {
        throw new Error("Forbidden");
      }
    } else {
      assertRoleAccess(session.role, { oneOf: permissionRules.manageProposals });
    }

    const proposal = await ProposalModel.findOne({ leadId }).sort({ version: -1 }).lean();
    return ok(serializeForJson(proposal));
  } catch (error) {
    return handleApiError(error);
  }
}

// Client-side response to a Proposal - unlike the Scope Manifest, a client
// can sign a Proposal directly here. High-ticket leads still need internal
// approval: the signature is real and recorded, but approvalStatus stays
// "pending" until a partner/admin clears it via the existing staff PATCH
// route on /api/proposals/[id] (which already flips approvalStatus to
// "approved" when an admin/partner sets status:"signed").

import { connectToDatabase } from "@/lib/db/mongodb";
import { LeadModel, ProposalModel } from "@/models";
import { getCurrentSession } from "@/lib/auth/session";
import { resolveClientLeadId } from "@/lib/auth/client-lead";
import { respondProposalSchema } from "@/lib/validation/proposal";
import { logActivity } from "@/lib/activity/logging";
import { handleApiError, fail, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const session = await getCurrentSession();
    if (!session) throw new Error("Unauthorized");
    if (session.role !== "client") throw new Error("Forbidden");

    const { id } = await params;
    const proposal = await ProposalModel.findById(id);
    if (!proposal) {
      return fail("Proposal not found", 404);
    }

    const clientLeadId = await resolveClientLeadId(session);
    if (!clientLeadId || clientLeadId !== String(proposal.leadId)) {
      throw new Error("Forbidden");
    }

    const payload = respondProposalSchema.parse(await request.json());
    if (payload.decision === "reject" && !payload.reason) {
      return fail("A reason is required when requesting changes", 422);
    }
    if (!["sent", "viewed"].includes(proposal.status)) {
      return fail(`This proposal can't be responded to (current status: ${proposal.status})`, 409);
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const requestIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() : null;

    if (payload.decision === "reject") {
      proposal.status = "rejected";
      proposal.rejectedAt = new Date();
      proposal.rejectionReason = payload.reason ?? "";
      await proposal.save();

      await logActivity({
        action: "proposal_rejected",
        actorId: session.userId,
        entityType: "proposal",
        entityId: String(proposal._id),
        details: { leadId: String(proposal.leadId), version: proposal.version },
        ipAddress: requestIp ?? undefined,
      });

      return ok(serializeForJson(proposal.toObject()));
    }

    const lead = await LeadModel.findById(proposal.leadId).lean();
    if (!lead) throw new Error("Associated lead not found");

    proposal.status = "signed";
    proposal.signedAt = new Date();
    proposal.signedByName = session.fullName ?? session.email;
    proposal.signedFromIp = requestIp;
    proposal.approvalStatus = lead.priorityFlag ? "pending" : "approved";
    await proposal.save();

    if (!lead.priorityFlag) {
      await LeadModel.findByIdAndUpdate(proposal.leadId, { status: "qualified" });
    }

    await logActivity({
      action: "proposal_signed",
      actorId: session.userId,
      entityType: "proposal",
      entityId: String(proposal._id),
      details: {
        leadId: String(proposal.leadId),
        version: proposal.version,
        pendingApproval: Boolean(lead.priorityFlag),
      },
      ipAddress: requestIp ?? undefined,
    });

    return ok(serializeForJson(proposal.toObject()));
  } catch (error) {
    return handleApiError(error);
  }
}

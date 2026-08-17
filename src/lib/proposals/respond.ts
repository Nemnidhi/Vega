// Shared by the cookie-session route (src/app/api/proposals/[id]/respond/route.ts)
// and the shared-secret /api/client-portal/proposal/[id]/respond route the website
// calls - identical logic, only the caller's identity source differs.
//
// Unlike the Scope Manifest, a client can sign a Proposal directly here. High-ticket
// leads still need internal approval: the signature is real and recorded, but
// approvalStatus stays "pending" until a partner/admin clears it via the existing
// staff PATCH route on /api/proposals/[id].

import { LeadModel, ProposalModel } from "@/models";
import type { AuthSession } from "@/lib/auth/session";
import { resolveClientLeadId } from "@/lib/auth/client-lead";
import type { respondProposalSchema } from "@/lib/validation/proposal";
import { logActivity } from "@/lib/activity/logging";
import { ApiError } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";
import type { z } from "zod";

export async function respondToProposal(
  session: AuthSession,
  proposalId: string,
  payload: z.infer<typeof respondProposalSchema>,
  requestIp: string | null,
) {
  if (session.role !== "client") throw new Error("Forbidden");

  const proposal = await ProposalModel.findById(proposalId);
  if (!proposal) {
    throw new ApiError("Proposal not found", 404);
  }

  const clientLeadId = await resolveClientLeadId(session);
  if (!clientLeadId || clientLeadId !== String(proposal.leadId)) {
    throw new Error("Forbidden");
  }

  if (payload.decision === "reject" && !payload.reason) {
    throw new ApiError("A reason is required when requesting changes", 422);
  }
  if (!["sent", "viewed"].includes(proposal.status)) {
    throw new ApiError(`This proposal can't be responded to (current status: ${proposal.status})`, 409);
  }

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

    return serializeForJson(proposal.toObject());
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

  return serializeForJson(proposal.toObject());
}

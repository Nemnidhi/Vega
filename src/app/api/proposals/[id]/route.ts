import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { updateProposalStatusSchema } from "@/lib/validation/proposal";
import { LeadModel, ProposalModel } from "@/models";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageProposals });

    const { id } = await params;
    const proposal = await ProposalModel.findById(id)
      .populate("leadId")
      .populate("clientId")
      .populate("scopeManifestId")
      .lean();

    if (!proposal) {
      throw new Error("Proposal not found");
    }

    return ok(serializeForJson(proposal));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageProposals });

    const { status } = updateProposalStatusSchema.parse(await request.json());
    const { id } = await params;
    const proposal = await ProposalModel.findById(id);
    if (!proposal) {
      throw new Error("Proposal not found");
    }

    const lead = await LeadModel.findById(proposal.leadId).lean();
    if (!lead) {
      throw new Error("Associated lead not found");
    }
    if (lead.priorityFlag && status === "signed" && !["admin", "partner"].includes(actor.role)) {
      throw new Error("High-ticket proposals can be approved only by Partner/Admin");
    }

    proposal.status = status;
    if (status === "signed" && ["admin", "partner"].includes(actor.role)) {
      proposal.approvalStatus = "approved";
    }
    await proposal.save();

    if (status === "sent") {
      await logActivity({
        action: "proposal_sent",
        actorId: actor.userId,
        entityType: "proposal",
        entityId: String(proposal._id),
        details: {},
      });
      await LeadModel.findByIdAndUpdate(proposal.leadId, { status: "negotiation" });
    }

    if (status === "signed") {
      await logActivity({
        action: "proposal_signed",
        actorId: actor.userId,
        entityType: "proposal",
        entityId: String(proposal._id),
        details: {},
      });
      await LeadModel.findByIdAndUpdate(proposal.leadId, { status: "qualified" });
    }

    return ok(serializeForJson(proposal));
  } catch (error) {
    return handleApiError(error);
  }
}

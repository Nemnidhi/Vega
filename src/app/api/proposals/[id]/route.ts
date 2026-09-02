import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { updateProposalStatusSchema } from "@/lib/validation/proposal";
import { LeadModel, ProposalModel } from "@/models";
import { logActivity } from "@/lib/activity/logging";
import { assertLeadCanBeClosedWon } from "@/lib/workflows/lead-guards";
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
      // A signed proposal must never move the lead backwards. This used to set "qualified",
      // which sits two stages *earlier* in the pipeline than the "negotiation" that sending
      // the proposal had already set - so the strongest signal in the funnel reset the lead's
      // stage and skewed every pipeline count reading off it.
      //
      // Signing does not by itself close the deal either: closed_won additionally requires a
      // completed and signed scope manifest, which assertLeadCanBeClosedWon enforces on the
      // status route. So the lead advances to closed_won only when that guard passes, and
      // otherwise holds at negotiation until the scope is locked.
      try {
        await assertLeadCanBeClosedWon(String(proposal.leadId));
        await LeadModel.findByIdAndUpdate(proposal.leadId, { status: "closed_won" });
      } catch {
        await LeadModel.findByIdAndUpdate(proposal.leadId, { status: "negotiation" });
      }
    }

    return ok(serializeForJson(proposal));
  } catch (error) {
    return handleApiError(error);
  }
}

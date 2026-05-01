import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { createProposalSchema } from "@/lib/validation/proposal";
import { LeadModel, ProposalModel, ScopeManifestModel } from "@/models";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageProposals });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const query: Record<string, string> = {};
    if (status) query.status = status;

    const proposals = await ProposalModel.find(query)
      .sort({ updatedAt: -1 })
      .populate("leadId", "title status priorityBand")
      .populate("clientId", "legalName primaryContactName")
      .lean();

    return ok(serializeForJson(proposals));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageProposals });

    const payload = createProposalSchema.parse(await request.json());
    const lead = await LeadModel.findById(payload.leadId).lean();
    if (!lead) {
      throw new Error("Lead not found");
    }

    const scopeManifest = await ScopeManifestModel.findById(payload.scopeManifestId).lean();
    if (!scopeManifest || String(scopeManifest.leadId) !== payload.leadId) {
      throw new Error("Valid Scope Manifest is required for proposal generation");
    }

    const latest = await ProposalModel.findOne({ leadId: payload.leadId })
      .sort({ version: -1 })
      .lean();
    const version = latest ? latest.version + 1 : 1;

    const approvalStatus =
      lead.priorityFlag && !["admin", "partner"].includes(actor.role)
        ? "pending"
        : payload.approvalStatus;

    const proposal = await ProposalModel.create({
      ...payload,
      version,
      approvalStatus,
    });

    await LeadModel.findByIdAndUpdate(payload.leadId, { $set: { status: "proposal_sent" } });

    await logActivity({
      action: "proposal_generated",
      actorId: actor.userId,
      entityType: "proposal",
      entityId: String(proposal._id),
      details: { leadId: payload.leadId, version, approvalStatus },
    });

    return ok(serializeForJson(proposal), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

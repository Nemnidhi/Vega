import { LeadModel, ProposalModel, ScopeManifestModel } from "@/models";

export async function assertLeadCanBeClosedWon(leadId: string) {
  const scopeManifest = await ScopeManifestModel.findOne({ leadId }).lean();

  if (!scopeManifest || !scopeManifest.isCompleted || !scopeManifest.signedAt) {
    throw new Error(
      "Lead cannot move to Closed Won without completed and signed Scope Manifest",
    );
  }

  const signedProposal = await ProposalModel.findOne({
    leadId,
    status: "signed",
  }).lean();

  if (!signedProposal) {
    throw new Error("Lead cannot move to Closed Won without a signed proposal");
  }
}

export async function assertEngineeringCanStart(leadId: string) {
  const lead = await LeadModel.findById(leadId).lean();
  if (!lead) {
    throw new Error("Lead not found");
  }

  const scopeManifest = await ScopeManifestModel.findOne({ leadId }).lean();
  if (!scopeManifest || !scopeManifest.isCompleted) {
    throw new Error("Engineering blocked: scope lock is incomplete");
  }

  const signedProposal = await ProposalModel.findOne({
    leadId,
    status: "signed",
  }).lean();

  if (!signedProposal) {
    throw new Error("Engineering blocked: proposal is not signed");
  }
}

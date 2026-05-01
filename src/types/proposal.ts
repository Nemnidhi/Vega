import type { ApprovalStatus, BaseDocument, CurrencyCode, ObjectId } from "@/types/common";

export type ProposalStatus =
  | "draft"
  | "generated"
  | "sent"
  | "viewed"
  | "signed"
  | "rejected";

export interface ProposalMilestone {
  label: string;
  amount: number;
  dueBy: Date | null;
  currency: CurrencyCode;
}

export interface ProposalPricingLine {
  componentId?: ObjectId | null;
  label: string;
  amount: number;
  quantity: number;
  currency: CurrencyCode;
}

export interface Proposal extends BaseDocument {
  leadId: ObjectId;
  clientId: ObjectId;
  scopeManifestId: ObjectId;
  version: number;
  status: ProposalStatus;
  projectSummary: string;
  scopeOfWork: string[];
  exclusions: string[];
  timeline: string;
  milestones: ProposalMilestone[];
  pricing: ProposalPricingLine[];
  paymentSchedule: ProposalMilestone[];
  changeOrderClause: string;
  signatureBlock: string;
  approvalStatus: ApprovalStatus;
}

import type { ApprovalStatus, BaseDocument, CurrencyCode, ObjectId } from "@/types/common";

export interface ChangeOrder extends BaseDocument {
  leadId: ObjectId;
  clientId: ObjectId;
  proposalId: ObjectId;
  scopeManifestId: ObjectId;
  requestedFeature: string;
  reasonOutOfScope: string;
  additionalPrice: number;
  currency: CurrencyCode;
  timelineImpactDays: number;
  approvalStatus: ApprovalStatus;
  approvedBy?: ObjectId | null;
  approvedAt?: Date | null;
}

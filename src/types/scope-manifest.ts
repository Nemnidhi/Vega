import type { BaseDocument, ObjectId } from "@/types/common";

export interface ScopeSection {
  heading: string;
  content: string;
}

export interface ScopeManifest extends BaseDocument {
  leadId: ObjectId;
  clientId: ObjectId;
  businessObjective: string;
  confirmedDeliverables: string[];
  exclusions: string[];
  clientResponsibilities: string[];
  timelineAssumptions: string[];
  paymentMilestones: ScopeSection[];
  revisionLimits: string;
  maintenanceTerms: string;
  changeOrderRules: string;
  isCompleted: boolean;
  signedAt?: Date | null;
  preparedBy: ObjectId;
  approvedBy?: ObjectId | null;
}

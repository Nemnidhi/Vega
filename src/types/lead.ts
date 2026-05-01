import type { BaseDocument, CurrencyCode, ObjectId } from "@/types/common";

export type LeadSource =
  | "website"
  | "referral"
  | "cold_outreach"
  | "paid_ads"
  | "event"
  | "partner"
  | "other";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal_sent"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export type LeadCategory =
  | "software_request"
  | "infrastructure"
  | "legal_automation"
  | "retainer_enterprise"
  | "other";

export type LeadUrgency = "low" | "medium" | "high" | "critical";

export type LeadPriorityBand =
  | "heavy_artillery"
  | "standard_sales"
  | "volume_pipeline";

export interface BudgetRange {
  min: number;
  max: number;
  currency: CurrencyCode;
}

export interface Lead extends BaseDocument {
  title: string;
  contactName: string;
  email: string;
  phone?: string;
  source: LeadSource;
  status: LeadStatus;
  category: LeadCategory;
  urgency: LeadUrgency;
  budget?: BudgetRange;
  description: string;
  sourceDomain?: string;
  sourcePath?: string;
  sourceReferrer?: string;
  score?: number;
  priorityBand?: LeadPriorityBand;
  priorityFlag?: boolean;
  ownerId?: ObjectId | null;
  clientId?: ObjectId | null;
  tags: string[];
}

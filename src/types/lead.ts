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
  | "closed_lost"
  | "invalid";

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

/**
 * Audit-processing pipeline, ported from the Samvid Lead Engine. Deliberately
 * separate from `LeadStatus`: that one tracks the *sales* conversation, this
 * one tracks how far we've got auditing the prospect's digital presence. A
 * lead can be `contacted` (sales) and `classified` (prospecting) at once.
 */
export type ProspectingStatus =
  | "new"
  | "enriched"
  | "classified"
  | "reported"
  | "sent";

/** How bad the prospect's digital presence is - A (none) to D (strong). */
export type ProspectingTier = "A" | "B" | "C" | "D";

/** "full" only when every channel was actually checked. */
export type ProspectingConfidence = "partial" | "full";

export interface BudgetRange {
  min: number;
  max: number;
  currency: CurrencyCode;
}

export interface LeadProspecting {
  /** Samvid's old integer `lead_id`. Migration reference only. */
  legacyLeadId?: number;
  /** One of the 20 industryKnowledge keys. */
  industry?: string;
  /** Value-chain segment within that industry. */
  segment?: string;
  /** How `industry` was decided - see resolve-industry.ts. */
  industryConfidence?: "explicit" | "high" | "low" | "unknown";
  industryMatchedOn?: string | null;
  /** A sector the source named that the knowledge bank doesn't cover yet. */
  unmappedIndustryLabel?: string | null;
  /** Free text from the source data, used to infer `segment`. */
  businessCategory?: string;
  state?: string;
  district?: string;
  /** Samvid's `agent_type` - entity form (Proprietorship, Partnership Firm...). */
  entityType?: string;
  /** RERA / statutory registration number from the source registry. */
  registrationNo?: string;
  /** Samvid's own source-list priority, unrelated to Vega's `score`. */
  priorityScore?: number;
  priorityTier?: string;
  prospectingStatus?: ProspectingStatus;
  digitalPresence?: {
    website?: { found?: boolean; url?: string | null; checkedAt?: Date | null };
    googleBusiness?: {
      checked?: boolean;
      found?: boolean | null;
      rating?: number | null;
      reviewCount?: number | null;
      placeName?: string | null;
      nameMatch?: "strong" | "weak" | "unverifiable";
      nameSimilarity?: number | null;
      reason?: string | null;
      checkedAt?: Date | null;
    };
    metaAds?: {
      checked?: boolean;
      found?: boolean | null;
      activeCount?: number | null;
      checkedAt?: Date | null;
    };
    technicalSeo?: {
      checked?: boolean;
      seoScore?: number | null;
      performanceScore?: number | null;
      isMobileFriendly?: boolean | null;
      isIndexable?: boolean | null;
      largestContentfulPaintMs?: number | null;
      issues?: string[];
      auditedUrl?: string | null;
      reason?: string | null;
      checkedAt?: Date | null;
    };
  };
  classification?: {
    category?: ProspectingTier;
    confidence?: ProspectingConfidence;
    signalsChecked?: number;
    signalsFound?: number;
    reasoning?: string;
    classifiedAt?: Date | null;
  };
}

export interface Lead extends BaseDocument {
  title: string;
  /**
   * Optional only for `cold_outreach`: prospects sourced from public
   * registries have a business name but no named contact. Inbound leads still
   * require these - see `createLeadSchema` in `@/lib/validation/lead`.
   */
  contactName?: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  status: LeadStatus;
  category?: LeadCategory;
  urgency?: LeadUrgency;
  budget?: BudgetRange;
  description?: string;
  sourceDomain?: string;
  sourcePath?: string;
  sourceReferrer?: string;
  score?: number;
  priorityBand?: LeadPriorityBand;
  priorityFlag?: boolean;
  ownerId?: ObjectId | null;
  clientId?: ObjectId | null;
  tags: string[];
  prospecting?: LeadProspecting;
}

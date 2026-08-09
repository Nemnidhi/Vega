import type { ProspectingConfidence, ProspectingTier } from "@/types/lead";

/**
 * `checked` and `found` are deliberately separate everywhere in here: a
 * failed or unconfigured API call is "not checked", never a false "not
 * found". The classifier depends on being able to tell those apart.
 */
export interface WebsiteSignal {
  found: boolean;
  url: string | null;
  checkedAt: Date;
  note?: string;
}

export interface GoogleBusinessSignal {
  checked: boolean;
  found: boolean | null;
  rating: number | null;
  reviewCount: number | null;
  placeName?: string | null;
  /** Whether the returned listing name actually matches the business. */
  nameMatch?: "strong" | "weak" | "unverifiable";
  /** 0-1, stored so the threshold can be retuned without re-calling the API. */
  nameSimilarity?: number | null;
  reason?: string;
  checkedAt: Date;
}

export interface MetaAdsSignal {
  checked: boolean;
  found: boolean | null;
  activeCount: number | null;
  reason?: string;
  checkedAt: Date;
}

export interface EnrichmentSignals {
  website?: WebsiteSignal;
  googleBusiness?: GoogleBusinessSignal;
  metaAds?: MetaAdsSignal;
}

export interface ClassificationResult {
  category: ProspectingTier;
  reasoning: string;
  signalsChecked: number;
  signalsFound: number;
  confidence: ProspectingConfidence;
}

/**
 * The subset of a Lead the report pipeline actually reads. Kept structural
 * rather than tied to the Mongoose document so a plain object can be passed
 * in for testing and previews.
 */
export interface ProspectSubject {
  name: string;
  state?: string | null;
  district?: string | null;
  entityType?: string | null;
  industry?: string | null;
  segment?: string | null;
  businessCategory?: string | null;
  /** Manual override for the "How This Plays Out Today" paragraph. */
  painPoints?: string | null;
}

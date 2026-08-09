// Bridges a unified Lead document to the shapes the prospecting pipeline
// works in. Keeps the Mongoose document out of the report/classifier code,
// which is written against plain structural types.

import type {
  ClassificationResult,
  EnrichmentSignals,
  ProspectSubject,
} from "@/lib/prospecting/types";
import type { Lead } from "@/types/lead";

type LeadLike = Pick<Lead, "title" | "prospecting">;

export function toProspectSubject(lead: LeadLike): ProspectSubject {
  const p = lead.prospecting;
  return {
    name: lead.title,
    state: p?.state ?? null,
    district: p?.district ?? null,
    entityType: p?.entityType ?? null,
    industry: p?.industry ?? null,
    segment: p?.segment ?? null,
    businessCategory: p?.businessCategory ?? null,
  };
}

export function toEnrichmentSignals(lead: LeadLike): EnrichmentSignals {
  const dp = lead.prospecting?.digitalPresence;
  if (!dp) return {};

  const signals: EnrichmentSignals = {};

  if (dp.website) {
    signals.website = {
      found: Boolean(dp.website.found),
      url: dp.website.url ?? null,
      checkedAt: dp.website.checkedAt ?? new Date(),
    };
  }
  if (dp.googleBusiness) {
    signals.googleBusiness = {
      checked: Boolean(dp.googleBusiness.checked),
      found: dp.googleBusiness.found ?? null,
      rating: dp.googleBusiness.rating ?? null,
      reviewCount: dp.googleBusiness.reviewCount ?? null,
      placeName: dp.googleBusiness.placeName ?? null,
      nameMatch: dp.googleBusiness.nameMatch,
      nameSimilarity: dp.googleBusiness.nameSimilarity ?? null,
      checkedAt: dp.googleBusiness.checkedAt ?? new Date(),
    };
  }
  if (dp.metaAds) {
    signals.metaAds = {
      checked: Boolean(dp.metaAds.checked),
      found: dp.metaAds.found ?? null,
      activeCount: dp.metaAds.activeCount ?? null,
      checkedAt: dp.metaAds.checkedAt ?? new Date(),
    };
  }

  return signals;
}

/**
 * The stored classification, or null when the lead hasn't been classified.
 * Callers decide whether to classify on the fly or refuse - a report should
 * never invent a tier.
 */
export function toClassificationResult(lead: LeadLike): ClassificationResult | null {
  const c = lead.prospecting?.classification;
  if (!c?.category) return null;

  return {
    category: c.category,
    confidence: c.confidence ?? "partial",
    signalsChecked: c.signalsChecked ?? 0,
    signalsFound: c.signalsFound ?? 0,
    reasoning: c.reasoning ?? "",
  };
}

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
  if (dp.metaPresence) {
    signals.metaPresence = {
      checked: Boolean(dp.metaPresence.checked),
      facebookFound: dp.metaPresence.facebookFound ?? null,
      facebookFollowers: dp.metaPresence.facebookFollowers ?? null,
      facebookPlaceName: dp.metaPresence.facebookPlaceName ?? null,
      instagramFound: dp.metaPresence.instagramFound ?? null,
      instagramFollowers: dp.metaPresence.instagramFollowers ?? null,
      reason: dp.metaPresence.reason ?? undefined,
      checkedAt: dp.metaPresence.checkedAt ?? new Date(),
    };
  }
  if (dp.technicalSeo) {
    signals.technicalSeo = {
      checked: Boolean(dp.technicalSeo.checked),
      seoScore: dp.technicalSeo.seoScore ?? null,
      performanceScore: dp.technicalSeo.performanceScore ?? null,
      isMobileFriendly: dp.technicalSeo.isMobileFriendly,
      isIndexable: dp.technicalSeo.isIndexable,
      largestContentfulPaintMs: dp.technicalSeo.largestContentfulPaintMs ?? null,
      issues: dp.technicalSeo.issues ?? [],
      auditedUrl: dp.technicalSeo.auditedUrl ?? undefined,
      reason: dp.technicalSeo.reason ?? undefined,
      checkedAt: dp.technicalSeo.checkedAt ?? new Date(),
    };
  }

  return signals;
}

/**
 * Which of the catalog's real gap tags (website/google/seo/social - see
 * recommend.ts's GAP_RATIONALE, the only tags any PricingComponent is ever
 * tagged against) this lead's measured signals actually support. A channel
 * that was never checked contributes nothing - "not checked" must never be
 * read as "missing", same rule the classifier already follows.
 */
export function toMissingGapTags(enrichment: EnrichmentSignals): string[] {
  const tags: string[] = [];

  if (enrichment.website && !enrichment.website.found) tags.push("website");
  if (enrichment.googleBusiness?.checked && !enrichment.googleBusiness.found) tags.push("google");
  // A poorly-scoring site is a real gap, but only once a site exists to score -
  // no site to audit is already covered by the "website" tag above.
  if (
    enrichment.website?.found &&
    enrichment.technicalSeo?.checked &&
    (enrichment.technicalSeo.seoScore ?? 100) < 70
  ) {
    tags.push("seo");
  }
  const noMetaAds = enrichment.metaAds?.checked && !enrichment.metaAds.found;
  const noFacebook = enrichment.metaPresence?.checked && enrichment.metaPresence.facebookFound === false;
  if (noMetaAds || noFacebook) tags.push("social");

  return tags;
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

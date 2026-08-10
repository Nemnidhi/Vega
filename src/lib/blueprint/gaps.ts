/**
 * Gap vocabulary for the blueprint.
 *
 * The audit *report* collapses everything into "website" and "social",
 * which is fine for matching industry pain points but too coarse to drive a
 * quote: it caused a technical SEO audit to be recommended to a business
 * with no website, and a Google Business setup to be justified by "no
 * website found".
 *
 * These four are what the audit can actually distinguish.
 */
import type { EnrichmentSignals } from "@/lib/prospecting/types";

export type BlueprintGap = "website" | "google" | "seo" | "social";

/** Below this, an existing site is weak enough to be worth selling fixes for. */
export const WEAK_SEO_SCORE = 70;

export function gapsFromSignals(enrichment: EnrichmentSignals): BlueprintGap[] {
  const gaps: BlueprintGap[] = [];

  const hasWebsite = Boolean(enrichment.website?.found);
  if (!hasWebsite) gaps.push("website");

  // "Not checked" is not "not found" - the same discipline the classifier
  // uses. Only a confirmed absence is a gap we can sell against.
  if (enrichment.googleBusiness?.checked && enrichment.googleBusiness.found === false) {
    gaps.push("google");
  }
  if (enrichment.metaAds?.checked && enrichment.metaAds.found === false) {
    gaps.push("social");
  }

  // Only meaningful where a site exists and was actually measured.
  const seo = enrichment.technicalSeo;
  if (hasWebsite && seo?.checked && typeof seo.seoScore === "number" && seo.seoScore < WEAK_SEO_SCORE) {
    gaps.push("seo");
  }

  return gaps;
}

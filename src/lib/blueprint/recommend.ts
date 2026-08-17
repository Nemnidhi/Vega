/**
 * Turns what we know about a lead into a suggested set of components.
 *
 * The knowledge bank already did most of this work: each industry and
 * segment carries pain points tagged against the same gap categories the
 * audit measures ("website", "social"). So a recommendation is a join
 * between what the audit found missing and what the catalog answers - not a
 * fresh set of rules.
 *
 * Every suggestion carries a rationale in plain language, because it gets
 * shown to the client. "Recommended because we found no website" is honest;
 * an unexplained line item is not.
 */
import { getIndustryProfile } from "@/lib/prospecting/industry-knowledge";
import type { CatalogComponent, ScaleTier } from "@/lib/pricing/smb-catalog";
import { computeFinalPrice } from "@/lib/pricing/engine";

export interface RecommendationInput {
  industry?: string | null;
  segment?: string | null;
  scaleTier: ScaleTier;
  /** Gap tags from the audit - which channels came back missing. */
  missingGapTags: string[];
  /** Component codes the call established a need for. */
  requestedCodes?: string[];
  /** Component codes the client ruled out. */
  declinedCodes?: string[];
  /**
   * Per-component reason from the questionnaire, keyed by code. Without this
   * every answer-driven component reads "asked for during the discovery
   * call", which is untrue - the client said they keep enquiries in a
   * notebook; the executive drew the conclusion.
   */
  answerRationales?: Record<string, string>;
}

export interface RecommendedComponent {
  code: string;
  title: string;
  rationale: string;
  origin: "recommended" | "manual";
  features: Array<{ code: string; label: string; priceImpact: number }>;
  oneTimePrice: number;
  monthlyPrice: number;
  deliveryWeeksMin: number;
  deliveryWeeksMax: number;
  priceBasis: string;
}

/** Priced with default features only - the sensible starting build. */
function priceWithDefaults(component: CatalogComponent) {
  const defaults = component.features.filter((f) => f.isDefault);
  const featureImpact = defaults.reduce((sum, f) => sum + f.priceImpact, 0);

  // Margin floor applies to the feature uplift too, so a heavily-optioned
  // build can't be sold at a thinner margin than a bare one.
  const { finalPrice } = computeFinalPrice({
    basePrice: component.basePrice + featureImpact,
    complexityMultiplier: component.complexityMultiplier,
    marginPercentage: component.marginPercentage,
  });

  return {
    features: defaults.map((f) => ({ code: f.code, label: f.label, priceImpact: f.priceImpact })),
    oneTimePrice: finalPrice,
  };
}

/**
 * One sentence per gap, stating what was actually measured. These get shown
 * to the client, so each has to be true of that specific finding.
 */
const GAP_RATIONALE: Record<string, string> = {
  website:
    "The audit found no website, so someone searching for this business cannot find or verify it.",
  google:
    "No Google Business listing was found, so the business does not appear in local search or Maps.",
  seo:
    "The website exists but scores poorly on Google's own technical checks, so it is unlikely to rank.",
  social:
    "No active social presence was found, which is where credibility gets checked before first contact.",
};

/**
 * A reason specific to THIS component, stated as a measured fact.
 *
 * The knowledge bank's pain points are deliberately NOT used here. They are
 * written as industry narrative and tagged loosely against gap categories,
 * so "Inventory imbalance across size, colour & style" legitimately carries
 * the `website` tag - and reading it back as the reason to build a website
 * is nonsense. That text belongs in the document's narrative section, where
 * the audit report already uses it well.
 *
 * What goes on a line item is what the audit actually measured.
 */
function buildRationale(component: CatalogComponent, gaps: Set<string>, profileLabel?: string) {
  for (const tag of component.answersGapTags) {
    if (gaps.has(tag) && GAP_RATIONALE[tag]) return GAP_RATIONALE[tag];
  }

  return profileLabel
    ? `Commonly needed by a ${profileLabel.toLowerCase()} business.`
    : "Commonly needed by businesses of this type.";
}

function suitsIndustry(component: CatalogComponent, industry?: string | null) {
  if (component.appliesToIndustries.length === 0) return true;
  return Boolean(industry) && component.appliesToIndustries.includes(industry!);
}

export function recommendComponents(
  catalog: CatalogComponent[],
  input: RecommendationInput,
): RecommendedComponent[] {
  const declined = new Set((input.declinedCodes ?? []).map((c) => c.toUpperCase()));
  const requested = new Set((input.requestedCodes ?? []).map((c) => c.toUpperCase()));
  const gaps = new Set(input.missingGapTags);

  const profile = getIndustryProfile(input.industry, { segment: input.segment });

  const out: RecommendedComponent[] = [];

  for (const component of catalog) {
    if (declined.has(component.code)) continue;

    const wasRequested = requested.has(component.code);
    const inScale = component.scaleTiers.includes(input.scaleTier);
    const inIndustry = suitsIndustry(component, input.industry);
    const answersAGap = component.answersGapTags.some((t) => gaps.has(t));

    // An explicit request always wins - the client asking for something
    // outranks any rule here.
    if (!wasRequested && (!inScale || !inIndustry || !answersAGap)) continue;

    const rationale = wasRequested
      ? (input.answerRationales?.[component.code] ?? "Asked for during the discovery call.")
      : buildRationale(component, gaps, profile?.label);

    const priced = priceWithDefaults(component);
    out.push({
      code: component.code,
      title: component.title,
      rationale,
      origin: wasRequested ? "manual" : "recommended",
      features: priced.features,
      oneTimePrice: priced.oneTimePrice,
      monthlyPrice: component.monthlyPrice,
      deliveryWeeksMin: component.deliveryWeeksMin,
      deliveryWeeksMax: component.deliveryWeeksMax,
      priceBasis: component.priceBasis,
    });
  }

  return out;
}

/**
 * A range, never a point. The spread reflects how much is genuinely unknown:
 * an indicative estimate off a first call deserves a wider band than one
 * taken after a proper requirements session.
 */
export const CONFIDENCE_SPREAD: Record<"indicative" | "informed" | "firm", number> = {
  indicative: 0.35,
  informed: 0.18,
  firm: 0.08,
};

/** Rounds a price to the nearest Rs 500 - shared by every estimate calculation in this module. */
export const round = (n: number) => Math.round(n / 500) * 500;

export function summariseEstimate(
  components: RecommendedComponent[],
  confidence: "indicative" | "informed" | "firm" = "indicative",
) {
  const oneTime = components.reduce((sum, c) => sum + c.oneTimePrice, 0);
  const monthly = components.reduce((sum, c) => sum + c.monthlyPrice, 0);
  const spread = CONFIDENCE_SPREAD[confidence];

  // Components overlap in effort, so the longest single build is a better
  // floor than the sum, while the sum is a fair worst case for the ceiling.
  const weeksMin = components.reduce((max, c) => Math.max(max, c.deliveryWeeksMin), 0);
  const weeksMax = components.reduce((sum, c) => sum + c.deliveryWeeksMax, 0);

  return {
    oneTimeMin: round(oneTime * (1 - spread)),
    oneTimeMax: round(oneTime * (1 + spread)),
    monthlyMin: round(monthly * (1 - spread)),
    monthlyMax: round(monthly * (1 + spread)),
    currency: "INR" as const,
    confidence,
    deliveryWeeksMin: weeksMin,
    deliveryWeeksMax: weeksMax,
  };
}

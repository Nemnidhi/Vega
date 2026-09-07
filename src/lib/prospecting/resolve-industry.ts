/**
 * Decides which knowledge-bank industry (and segment) a lead belongs to.
 *
 * This is the piece that was missing: the knowledge bank keys everything off
 * `prospecting.industry`, but nothing ever populated that field, so every
 * lead fell back to generic pain points and 20 industries of research sat
 * unused. Industry must be resolved **once, at ingestion** - when a lead is
 * scraped, imported, or captured - not patched in at report-render time.
 *
 * Three tiers, strongest first:
 *   1. explicit  - the source told us (a sector-per-sheet workbook, an
 *                  `Industry` column, a scraper's target sector)
 *   2. high      - a regulatory registration or a category-field keyword
 *   3. low       - a keyword seen only in the company name
 * Anything else resolves to null. A wrong industry is worse than none: it
 * puts confidently wrong claims about someone's business in front of them.
 */

import {
  INDUSTRY_KNOWLEDGE,
  getBiasedDefaultSegment,
  inferSegmentFromText,
  resolveSegment,
  type SegmentHint,
} from "@/lib/prospecting/industry-knowledge";

export type IndustryConfidence = "explicit" | "high" | "low" | "unknown";

export interface IndustrySignals {
  /** An industry name the source stated outright - sheet name, CSV column. */
  industryLabel?: string | null;
  businessCategory?: string | null;
  productsServices?: string | null;
  name?: string | null;
  entityType?: string | null;
  registrationNo?: string | null;
  description?: string | null;
  /**
   * What kind of businesses this source is a list of, when the source knows
   * and the individual rows don't say. A curated B2B database of established
   * companies should not fall back to the bottom-up "small trader" default.
   * Only used when the row's own text is inconclusive.
   */
  segmentBias?: "established" | "small" | null;
}

export interface ResolvedIndustry {
  industry: string | null;
  segment: string | null;
  confidence: IndustryConfidence;
  /** Which signal decided it, for auditing a bad classification later. */
  matchedOn: string | null;
  /**
   * Set when the source named a sector we have no knowledge-bank entry for
   * (e.g. "Cement & Building Materials"). The lead still imports; it just
   * gets generic report copy. Surfacing this is how we learn which entries
   * to research next.
   */
  unmappedLabel?: string | null;
}

function normalize(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Source labels -> knowledge-bank keys. Covers the sheet names used by the
 * Indore / Madhya Pradesh workbooks plus obvious variants.
 */
const INDUSTRY_ALIASES: Record<string, string> = {};

function alias(key: string, ...labels: string[]) {
  for (const label of labels) {
    INDUSTRY_ALIASES[normalize(label)] = key;
  }
}

// Every knowledge-bank key matches its own name and its own label.
for (const [key, industry] of Object.entries(INDUSTRY_KNOWLEDGE)) {
  alias(key, key.replace(/_/g, " "), industry.label);
}

alias("textile_apparel", "Textile & Apparel", "Textiles", "Apparel", "Garments");
alias("food_processing", "Food Processing", "Food & Beverage", "Food and Beverages", "Dairy");
alias("automobile_auto_components", "Automobile & Auto Components", "Automotive", "Auto Components");
alias("metals_heavy_industry", "Metals & Heavy Industry", "Metals", "Steel", "Heavy Engineering");
alias("chemicals", "Chemicals & Petrochemicals", "Chemicals", "Petrochemicals");
alias(
  "pharmaceuticals_healthcare",
  "Pharmaceuticals & Healthcare Manufacturing",
  "Pharmaceuticals & Healthcare Ma",
  "Pharma",
  "Pharmaceuticals",
);
alias("electronics_electricals", "Electronics & Electricals", "Electronics", "Electricals");
alias("paper_packaging", "Paper & Packaging", "Packaging", "Paper");
alias("leather_footwear", "Leather & Footwear", "Leather", "Footwear");
alias("construction", "Construction Industry", "Construction", "Infrastructure", "Real Estate Construction");
alias("it_technology_services", "IT & Technology Services", "IT Services", "Information Technology", "Software");
alias("financial_services", "Financial Services", "Finance", "BFSI", "Banking");
alias("professional_services", "Professional Services", "Consulting", "Legal Services", "Accounting");
alias("trade_services", "Trade & Commerce", "Trade and Commerce", "Trading", "Wholesale Trade", "Retail Trade");
alias("logistics_transportation", "Logistics & Transportation", "Logistics", "Transportation", "Supply Chain");
alias("healthcare_services", "Healthcare Services", "Healthcare", "Hospitals", "Clinics");
alias("education_services", "Education", "Education Services", "EdTech", "Coaching");
alias("hospitality_tourism", "Hospitality & Tourism", "Hospitality", "Tourism", "Hotels", "Travel");
alias("media_communication", "Media & Communication", "Media", "Advertising", "Communications");
alias("real_estate", "Real Estate", "Realty", "Property");

/**
 * Sectors the source data contains but the knowledge bank does not cover.
 * Listed explicitly so they resolve to "known unknown" rather than being
 * mis-matched into a neighbouring industry by keyword bleed.
 */
const KNOWN_UNMAPPED = new Set(
  [
    "Cement & Building Materials",
    "Cement",
    "Building Materials",
    "Entertainment, Events, Fitness",
    "Entertainment, Events, Fitness & Wellness",
    "Entertainment Events Fitness",
    "Entertainment",
    "Events",
    "Fitness",
  ].map(normalize),
);

/**
 * Statutory registration formats that identify a sector outright. Far more
 * reliable than a keyword: a RERA number means real estate, full stop.
 */
const REGISTRATION_SIGNALS: Array<{ pattern: RegExp; industry: string; label: string }> = [
  { pattern: /RERA/i, industry: "real_estate", label: "RERA registration" },
];

/**
 * Keyword hints, used only when the source didn't name a sector. Ordered
 * lists are irrelevant - matches are scored, and the highest distinct-hit
 * count wins. Keep terms specific enough not to bleed across industries.
 */
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  textile_apparel: ["textile", "apparel", "garment", "fabric", "hosiery", "readymade", "spinning", "weaving", "dyeing", "yarn", "boutique"],
  pharmaceuticals_healthcare: ["pharmaceutical", "pharma", "formulation", "api manufactur", "drug manufactur", "medicine manufactur"],
  professional_services: ["chartered accountant", "advocate", "law firm", "legal service", "consultancy", "consulting", "audit firm", "company secretary", "tax consultant"],
  real_estate: ["real estate", "realty", "property dealer", "estate agent", "builder", "colonizer", "developers", "property consultant", "broker"],
  trade_services: ["trading company", "wholesale", "distributor", "stockist", "general merchant", "retail store", "kirana"],
  chemicals: ["chemical", "petrochemical", "polymer", "resin", "solvent", "fertilizer", "pesticide"],
  metals_heavy_industry: ["steel", "foundry", "forging", "casting", "metal fabricat", "rolling mill", "alloy", "iron works"],
  automobile_auto_components: ["automobile", "auto component", "auto part", "vehicle dealer", "car dealer", "two wheeler", "garage", "workshop"],
  food_processing: ["food processing", "dairy", "bakery", "snack", "namkeen", "flour mill", "spice", "beverage", "packaged food", "grain milling"],
  construction: ["construction", "contractor", "civil work", "infrastructure", "epc", "builder and contractor"],
  leather_footwear: ["leather", "footwear", "tannery", "shoe manufactur"],
  education_services: ["school", "college", "coaching", "tuition", "academy", "institute of", "education", "training center", "training centre"],
  healthcare_services: ["hospital", "clinic", "nursing home", "diagnostic", "pathology", "dental", "physiotherapy", "medical center", "medical centre"],
  logistics_transportation: ["logistics", "transport", "courier", "freight", "cargo", "warehousing", "packers and movers", "fleet"],
  media_communication: ["advertising", "media", "printing press", "digital marketing", "production house", "event management", "photography"],
  paper_packaging: ["packaging", "corrugated", "paper mill", "carton", "flexible packaging", "printing and packaging"],
  electronics_electricals: ["electronic", "electrical", "switchgear", "cable manufactur", "led manufactur", "pcb"],
  financial_services: ["insurance", "nbfc", "finance company", "loan", "investment advisor", "mutual fund", "stock broker", "financial service"],
  hospitality_tourism: ["hotel", "resort", "restaurant", "travel agency", "tour operator", "banquet", "guest house", "homestay"],
  it_technology_services: ["software", "it service", "web development", "app development", "saas", "technology solution", "it solution"],
};

function matchKeywords(text: string): Array<{ industry: string; hits: string[] }> {
  const results: Array<{ industry: string; hits: string[] }> = [];
  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    const hits = keywords.filter((kw) => text.includes(kw));
    if (hits.length) results.push({ industry, hits });
  }
  return results.sort((a, b) => b.hits.length - a.hits.length);
}

/** Best keyword match, or null when nothing matched or two industries tie. */
function bestKeywordMatch(raw?: string | null) {
  const text = normalize(raw);
  if (!text) return null;

  const matches = matchKeywords(text);
  if (!matches.length) return null;
  // A tie means the text genuinely doesn't distinguish - don't guess.
  if (matches.length > 1 && matches[1].hits.length === matches[0].hits.length) return null;

  return { industry: matches[0].industry, matchedOn: matches[0].hits[0] };
}

export function normalizeIndustryKey(label?: string | null): string | null {
  const key = normalize(label);
  if (!key) return null;
  return INDUSTRY_ALIASES[key] ?? null;
}

export function isKnownUnmappedIndustry(label?: string | null) {
  return KNOWN_UNMAPPED.has(normalize(label));
}

export function resolveProspectIndustry(signals: IndustrySignals): ResolvedIndustry {
  const segmentText =
    signals.businessCategory || signals.productsServices || signals.entityType || signals.name || null;

  const withSegment = (
    industry: string | null,
    confidence: IndustryConfidence,
    matchedOn: string | null,
    unmappedLabel?: string | null,
  ): ResolvedIndustry => {
    const hint: SegmentHint = { text: segmentText };
    let segment: string | null = null;

    if (industry) {
      // The lead's own text wins. Only when it says nothing conclusive does
      // the source's bias decide, instead of the bottom-up default.
      const fromText = inferSegmentFromText(industry, segmentText);
      segment =
        fromText ??
        (signals.segmentBias
          ? getBiasedDefaultSegment(industry, signals.segmentBias)
          : resolveSegment(industry, hint));
    }

    return {
      industry,
      segment,
      confidence,
      matchedOn,
      ...(unmappedLabel ? { unmappedLabel } : {}),
    };
  };

  // 1. The source named a sector.
  if (signals.industryLabel) {
    const mapped = normalizeIndustryKey(signals.industryLabel);
    if (mapped) {
      return withSegment(mapped, "explicit", `industryLabel: ${signals.industryLabel}`);
    }
    if (isKnownUnmappedIndustry(signals.industryLabel)) {
      return withSegment(null, "unknown", null, signals.industryLabel);
    }
    // An unrecognised label still beats guessing from a company name, but we
    // fall through to the keyword tiers in case it is a phrasing variant.
  }

  // 2a. A statutory registration format.
  if (signals.registrationNo) {
    for (const signal of REGISTRATION_SIGNALS) {
      if (signal.pattern.test(signals.registrationNo)) {
        return withSegment(signal.industry, "high", signal.label);
      }
    }
  }

  // 2b. Category-style fields describe the business directly.
  for (const [field, value] of [
    ["businessCategory", signals.businessCategory],
    ["productsServices", signals.productsServices],
    ["industryLabel", signals.industryLabel],
    ["description", signals.description],
  ] as Array<[string, string | null | undefined]>) {
    const match = bestKeywordMatch(value);
    if (match) {
      return withSegment(match.industry, "high", `${field}: ${match.matchedOn}`);
    }
  }

  // 3. A company name is weak evidence - "Sharma Traders" says very little.
  const nameMatch = bestKeywordMatch(signals.name);
  if (nameMatch) {
    return withSegment(nameMatch.industry, "low", `name: ${nameMatch.matchedOn}`);
  }

  return withSegment(null, "unknown", null, signals.industryLabel ?? null);
}

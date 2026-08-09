// Technical SEO check via Google's PageSpeed Insights API, which runs
// Lighthouse server-side. Official, free, no scraping, no ban risk - unlike
// the LinkedIn and property-portal checks that were abandoned for exactly
// that reason.
//
// Every report generated so far has shown "Technical SEO: Not yet checked"
// because no checker existed. This fills that row with a real finding.
//
// Deliberately NOT part of tier classification. The A-D tier measures
// whether a business can be *found* at all; this measures the quality of a
// presence they already have. Folding it in would destabilise a tier
// distribution that was calibrated against 1,022 real listings.

import type { TechnicalSeoSignal } from "@/lib/prospecting/types";

const PSI_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

/** Audits worth repeating back to a business owner in plain language. */
const REPORTABLE_AUDITS: Record<string, string> = {
  "is-crawlable": "Search engines are blocked from indexing the page",
  "meta-description": "No meta description, so search results show no summary",
  "document-title": "Missing or unhelpful page title",
  viewport: "Not set up for mobile screens",
  "http-status-code": "Page returns an error status to search engines",
  "link-text": "Links use uninformative text like 'click here'",
  "crawlable-anchors": "Links cannot be followed by search engines",
  "image-alt": "Images have no alt text",
  "robots-txt": "robots.txt is invalid",
  "hreflang": "Invalid hreflang, which affects regional search results",
};

interface LighthouseAudit {
  score?: number | null;
  title?: string;
  numericValue?: number;
}

interface PsiResponse {
  error?: { message?: string; code?: number };
  lighthouseResult?: {
    categories?: {
      seo?: { score?: number | null };
      performance?: { score?: number | null };
    };
    audits?: Record<string, LighthouseAudit>;
  };
}

function notChecked(reason: string): TechnicalSeoSignal {
  return { checked: false, reason, checkedAt: new Date() };
}

function toPercent(score?: number | null) {
  return typeof score === "number" ? Math.round(score * 100) : null;
}

/**
 * `websiteUrl` comes from the website check - there is nothing to audit for
 * a business with no site, and saying "not checked" there would be
 * misleading. Callers should skip this entirely in that case.
 */
export async function checkTechnicalSeo(
  websiteUrl: string,
  // PageSpeed runs a full Lighthouse pass server-side and regularly takes
  // over a minute on slow sites - which is exactly the kind of site we are
  // auditing. 60s was too tight and aborted real results.
  { timeoutMs = 120_000 }: { timeoutMs?: number } = {},
): Promise<TechnicalSeoSignal> {
  // Falls back to the Places key so a single widened key can serve both,
  // but a dedicated key is cleaner - PageSpeed quota is per-key.
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return notChecked("GOOGLE_PAGESPEED_API_KEY not configured");
  }
  if (!websiteUrl) {
    return notChecked("no website to audit");
  }

  const url = new URL(PSI_URL);
  url.searchParams.set("url", websiteUrl);
  url.searchParams.append("category", "SEO");
  url.searchParams.append("category", "PERFORMANCE");
  // Mobile is the right default: it is what Google indexes with, and most
  // of these businesses are found on a phone.
  url.searchParams.set("strategy", "mobile");
  url.searchParams.set("key", apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal: controller.signal });
  } catch (error) {
    return notChecked(`PageSpeed request failed: ${(error as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  const data = (await response.json().catch(() => ({}))) as PsiResponse;

  if (!response.ok) {
    // 403 here almost always means the API is not enabled on the project, or
    // the key's API restrictions exclude PageSpeed Insights.
    return notChecked(
      `PageSpeed HTTP ${response.status}${data.error?.message ? `: ${data.error.message}` : ""}`,
    );
  }

  const categories = data.lighthouseResult?.categories;
  const audits = data.lighthouseResult?.audits ?? {};

  const issues: string[] = [];
  for (const [key, description] of Object.entries(REPORTABLE_AUDITS)) {
    const audit = audits[key];
    if (audit && typeof audit.score === "number" && audit.score < 1) {
      issues.push(description);
    }
  }

  const lcp = audits["largest-contentful-paint"]?.numericValue;

  // An audit Lighthouse didn't return is "not measured", NOT "failed".
  // Treating a missing `viewport` audit as false told a site with a perfectly
  // good mobile layout that it had none - and audit categories move between
  // Lighthouse versions, so this happens in practice.
  const booleanAudit = (key: string) => {
    const score = audits[key]?.score;
    return typeof score === "number" ? score === 1 : null;
  };

  return {
    checked: true,
    seoScore: toPercent(categories?.seo?.score),
    performanceScore: toPercent(categories?.performance?.score),
    isMobileFriendly: booleanAudit("viewport"),
    isIndexable: booleanAudit("is-crawlable"),
    largestContentfulPaintMs: typeof lcp === "number" ? Math.round(lcp) : null,
    issues: issues.slice(0, 6),
    auditedUrl: websiteUrl,
    checkedAt: new Date(),
  };
}

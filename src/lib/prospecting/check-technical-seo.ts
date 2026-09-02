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

  // PageSpeed is genuinely flaky: the same URL returned "Lighthouse returned
  // error: Something went wrong", then an HTML error page, then a clean
  // 100/100 - three failures and a success for a site that is completely
  // healthy. One retry turns most of that noise into a result.
  let data: PsiResponse = {};
  let status = 0;
  let transportError = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 3000));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let timedOut = false;
    try {
      const response = await fetch(url.toString(), { signal: controller.signal });
      status = response.status;
      // A failing PSI call can answer with an HTML error page, so a parse
      // failure is expected rather than exceptional.
      data = (await response.json().catch(() => ({}))) as PsiResponse;
      transportError = "";
    } catch (error) {
      timedOut = controller.signal.aborted;
      transportError = timedOut ? `timed out after ${timeoutMs / 1000}s` : (error as Error).message;
    } finally {
      clearTimeout(timer);
    }

    if (!transportError && status >= 200 && status < 300 && data.lighthouseResult) break;

    // Don't retry what won't change: a key or URL problem is permanent, and
    // retrying a timeout just spends another full timeout. One site took 243s
    // that way, which is enough to threaten the enrichment cron's budget.
    if (status === 403 || status === 400 || timedOut) break;
  }

  if (transportError) {
    return notChecked(`PageSpeed request failed: ${transportError}`);
  }
  if (status < 200 || status >= 300) {
    // 403 here almost always means the API is not enabled in Google Cloud, or
    // the key's API restrictions exclude PageSpeed Insights.
    return notChecked(
      `PageSpeed HTTP ${status}${data.error?.message ? `: ${data.error.message}` : ""}`,
    );
  }
  // A 200 with no lighthouseResult still means we learned nothing. Returning
  // checked:true with null scores here would claim an audit we never got.
  if (!data.lighthouseResult) {
    return notChecked(
      data.error?.message ? `PageSpeed: ${data.error.message}` : "PageSpeed returned no result",
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

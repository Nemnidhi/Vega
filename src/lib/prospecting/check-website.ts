// Lightweight, no-API-key website check: guesses a plausible domain from the
// business name and probes a few TLDs. This is a heuristic first pass, not a
// search engine - false negatives (real site under an unrelated domain) and
// false positives (parked domain that happens to resolve) are both possible.

import type { WebsiteSignal } from "@/lib/prospecting/types";

const LEGAL_SUFFIXES = [
  "private limited",
  "pvt ltd",
  "pvt.ltd",
  "pvt. ltd.",
  "limited liability partnership",
  "llp",
  "limited",
  "ltd",
  "firm",
  "company",
  "associates",
  "huf",
  "proprietorship",
  "propritorship",
  "partnership",
];

const PARKING_MARKERS = [
  "domain is for sale",
  "buydomains",
  "godaddy",
  "sedo",
  "domain parking",
  "this domain may be for sale",
  "hugedomains",
  "afternic",
];

// GoDaddy/Afternic (and similar parking services) serve a near-empty page
// whose only content is a client-side redirect into their marketplace - e.g.
// `<script>window.location.href="/lander"</script>`. Our fetch doesn't run
// JS, so it never reaches the real "for sale" page; a tiny body that's
// nothing but a location redirect is itself the signature to catch.
function looksLikeParkingStub(body: string) {
  return body.length < 500 && /location\.(href|replace)\s*=/.test(body);
}

export function slugify(name: string) {
  let s = ` ${name.toLowerCase()} `;
  for (const suffix of LEGAL_SUFFIXES) {
    s = s.split(` ${suffix} `).join(" ");
  }
  return s.replace(/[^a-z0-9]/g, "");
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkWebsite(
  businessName: string,
  { timeoutMs = 6000 }: { timeoutMs?: number } = {},
): Promise<WebsiteSignal> {
  const slug = slugify(businessName);
  if (!slug) {
    return {
      found: false,
      url: null,
      checkedAt: new Date(),
      note: "could not derive a domain guess from the business name",
    };
  }

  const candidates = [`https://${slug}.com`, `https://${slug}.in`, `https://${slug}.co.in`];

  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, timeoutMs);
      if (res.status >= 200 && res.status < 400) {
        const rawBody = await res.text();
        const body = rawBody.slice(0, 5000).toLowerCase();
        const looksParked =
          PARKING_MARKERS.some((marker) => body.includes(marker)) || looksLikeParkingStub(rawBody);
        if (!looksParked) {
          return { found: true, url, checkedAt: new Date() };
        }
      }
    } catch {
      // DNS failure, timeout, TLS error, etc. - just means this candidate isn't it
    }
  }

  return { found: false, url: null, checkedAt: new Date() };
}

// Rule-based classifier over enrichment signals. Deliberately not an LLM -
// this needs to be deterministic and auditable.
//
// Tiers (adapted from the original A/B/C/D spec to the signals we actually
// have - website, Google Business, Meta ads; no portal-listing check yet):
//   D - strong presence: 2+ of the checked channels found
//   C - some presence: exactly 1 channel found
//   B - appears minimal, but not fully confirmed: 0 channels found AND at
//       least one channel (Google Business / Meta) hasn't been checked yet -
//       i.e. we can't yet rule out a presence we haven't looked for
//   A - confirmed no digital presence: 0 channels found AND all 3 channels
//       have actually been checked
//
// `confidence` is "full" only when all 3 channels were checked, so
// downstream report copy can avoid asserting things we didn't verify.

import type { ClassificationResult, EnrichmentSignals } from "@/lib/prospecting/types";

export function classify(enrichment: EnrichmentSignals): ClassificationResult {
  const channels = [
    { name: "website", checked: true, found: Boolean(enrichment.website?.found) },
    {
      name: "google_business",
      checked: Boolean(enrichment.googleBusiness?.checked),
      found: Boolean(enrichment.googleBusiness?.found),
    },
    {
      name: "meta_ads",
      checked: Boolean(enrichment.metaAds?.checked),
      found: Boolean(enrichment.metaAds?.found),
    },
  ];

  const checkedChannels = channels.filter((c) => c.checked);
  const foundChannels = checkedChannels.filter((c) => c.found);
  const signalsChecked = checkedChannels.length;
  const signalsFound = foundChannels.length;

  let category: ClassificationResult["category"];
  if (signalsFound >= 2) {
    category = "D";
  } else if (signalsFound === 1) {
    category = "C";
  } else if (signalsChecked === 3) {
    category = "A";
  } else {
    category = "B";
  }

  const describe = (c: (typeof channels)[number]) => {
    if (!c.checked) return `${c.name}: not checked`;
    return `${c.name}: ${c.found ? "found" : "not found"}`;
  };
  const reasoning = channels.map(describe).join("; ");

  return {
    category,
    reasoning,
    signalsChecked,
    signalsFound,
    confidence: signalsChecked === 3 ? "full" : "partial",
  };
}

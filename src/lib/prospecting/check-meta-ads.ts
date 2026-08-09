// Stubbed until META_AD_LIBRARY_ACCESS_TOKEN is configured. Returns
// checked:false rather than guessing, so downstream classification can tell
// "not checked" apart from "checked, not found".
//
// Still blocked on Meta App Review. When it lands, mirror the pattern in
// check-google-business.ts: real API call, checked:false on any error, never
// guess.

import type { MetaAdsSignal } from "@/lib/prospecting/types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- name is used once the real lookup lands
export async function checkMetaAds(name: string): Promise<MetaAdsSignal> {
  const token = process.env.META_AD_LIBRARY_ACCESS_TOKEN;
  if (!token) {
    return {
      checked: false,
      found: null,
      activeCount: null,
      reason: "META_AD_LIBRARY_ACCESS_TOKEN not configured yet",
      checkedAt: new Date(),
    };
  }

  // TODO: real Ad Library API call, once a token is available.
  return {
    checked: false,
    found: null,
    activeCount: null,
    reason: "META_AD_LIBRARY_ACCESS_TOKEN present but lookup not yet implemented",
    checkedAt: new Date(),
  };
}

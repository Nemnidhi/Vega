// Real check via the Meta Ad Library API (ads_archive), using the same App
// Access Token as check-meta-presence.ts - no per-user OAuth. Falls back to
// checked:false (never a guessed absence) on any error, including the
// "feature not yet approved" response expected while App Review is pending.
// Mirrors the checked/found discipline in check-google-business.ts.

import type { MetaAdsSignal } from "@/lib/prospecting/types";

const ADS_ARCHIVE_URL = "https://graph.facebook.com/v22.0/ads_archive";

/** Leads in this database are India-based (Rajasthan/Gujarat/MP/Chhattisgarh). */
const DEFAULT_AD_REACHED_COUNTRIES = ["IN"];

interface AdsArchiveResponse {
  data?: unknown[];
  error?: { message?: string; code?: number };
}

function notChecked(reason: string): MetaAdsSignal {
  return { checked: false, found: null, activeCount: null, reason, checkedAt: new Date() };
}

export async function checkMetaAds(name: string): Promise<MetaAdsSignal> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  // META_AD_LIBRARY_ACCESS_TOKEN, if explicitly set, overrides the app
  // token - kept for the original env var name in case Ad Library access
  // ever needs a differently-scoped token than pages/search does.
  const overrideToken = process.env.META_AD_LIBRARY_ACCESS_TOKEN;

  const accessToken = overrideToken || (appId && appSecret ? `${appId}|${appSecret}` : null);
  if (!accessToken) {
    return notChecked("FACEBOOK_APP_ID/FACEBOOK_APP_SECRET (or META_AD_LIBRARY_ACCESS_TOKEN) not configured yet");
  }

  const url = new URL(ADS_ARCHIVE_URL);
  url.searchParams.set("search_terms", name);
  url.searchParams.set("ad_reached_countries", JSON.stringify(DEFAULT_AD_REACHED_COUNTRIES));
  url.searchParams.set("ad_type", "ALL");
  url.searchParams.set("ad_active_status", "ACTIVE");
  url.searchParams.set("fields", "id");
  url.searchParams.set("access_token", accessToken);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (err) {
    return notChecked(`Ad Library API request failed: ${(err as Error).message}`);
  }

  const data = (await response.json().catch(() => null)) as AdsArchiveResponse | null;

  if (!response.ok || !data || data.error) {
    return notChecked(
      data?.error?.message
        ? `Ad Library API error: ${data.error.message}`
        : `Ad Library API HTTP ${response.status}`,
    );
  }

  const activeCount = data.data?.length ?? 0;
  return {
    checked: true,
    found: activeCount > 0,
    activeCount,
    checkedAt: new Date(),
  };
}

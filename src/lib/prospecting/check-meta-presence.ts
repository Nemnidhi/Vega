// Facebook/Instagram presence + follower count via the Graph API's Pages
// Search, using a plain App Access Token (client_id|client_secret) - no
// per-user OAuth needed for this endpoint. Falls back to checked:false (not
// "not found") on any error, including the "feature not yet approved"
// response this will return until Meta's App Review clears - same discipline
// as check-google-business.ts. The moment that approval lands, this starts
// returning real data with no further code changes.

import { compareBusinessNames } from "@/lib/prospecting/name-similarity";
import type { MetaPresenceSignal } from "@/lib/prospecting/types";

const PAGES_SEARCH_URL = "https://graph.facebook.com/v22.0/pages/search";

interface PageResult {
  name?: string;
  fan_count?: number;
  followers_count?: number;
}

interface PagesSearchResponse {
  data?: PageResult[];
  error?: { message?: string; code?: number };
}

function notChecked(reason: string): MetaPresenceSignal {
  return {
    checked: false,
    facebookFound: null,
    facebookFollowers: null,
    instagramFound: null,
    instagramFollowers: null,
    reason,
    checkedAt: new Date(),
  };
}

export async function checkMetaPresence(name: string): Promise<MetaPresenceSignal> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    return notChecked("FACEBOOK_APP_ID/FACEBOOK_APP_SECRET not configured yet");
  }

  const url = new URL(PAGES_SEARCH_URL);
  url.searchParams.set("q", name);
  url.searchParams.set("fields", "id,name,link,fan_count,followers_count,verification_status");
  url.searchParams.set("access_token", `${appId}|${appSecret}`);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (err) {
    return notChecked(`Graph API request failed: ${(err as Error).message}`);
  }

  const data = (await response.json().catch(() => null)) as PagesSearchResponse | null;

  if (!response.ok || !data || data.error) {
    // Includes the expected "(#10) This endpoint requires ... Page Public
    // Metadata Access" response while App Review is still pending - a
    // permission gap is not a confirmed absence, so this stays not-checked.
    return notChecked(
      data?.error?.message
        ? `Graph API error: ${data.error.message}`
        : `Graph API HTTP ${response.status}`,
    );
  }

  const top = data.data?.[0];
  if (!top) {
    return {
      checked: true,
      facebookFound: false,
      facebookFollowers: null,
      instagramFound: null,
      instagramFollowers: null,
      checkedAt: new Date(),
    };
  }

  // Pages Search returns the nearest thing it can find rather than nothing -
  // same reasoning as the Google Places check, reusing the same comparator
  // rather than trusting the top result blindly.
  const match = compareBusinessNames(name, top.name ?? "");
  const found = match.verdict !== "weak";

  return {
    checked: true,
    facebookFound: found,
    facebookFollowers: found ? (top.followers_count ?? top.fan_count ?? null) : null,
    facebookPlaceName: top.name ?? null,
    instagramFound: null,
    instagramFollowers: null,
    reason:
      match.verdict === "weak"
        ? `top result "${top.name}" does not match the business name (similarity ${match.score?.toFixed(2)})`
        : match.verdict === "unverifiable"
          ? "listing name could not be compared (different script); accepted rather than wrongly denied"
          : undefined,
    checkedAt: new Date(),
  };
}

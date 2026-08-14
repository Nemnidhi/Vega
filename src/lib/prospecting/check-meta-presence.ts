// Facebook/Instagram presence + follower count. Facebook uses the Graph
// API's Pages Search with a plain App Access Token (client_id|client_secret)
// - no per-user OAuth needed for this endpoint. Falls back to checked:false
// (not "not found") on any error, including the "feature not yet approved"
// response this will return until Meta's App Review clears - same discipline
// as check-google-business.ts. The moment that approval lands, this starts
// returning real Facebook data with no further code changes.
//
// Instagram presence is chained off the matched Facebook Page's own
// `instagram_business_account` link first - Instagram's Graph API has no
// name-search endpoint, so a guessed handle risks attributing a stranger's
// follower count to the wrong business. Reading that link is Page Public
// Metadata Access again (App Access Token), but the actual business_discovery
// call needs a real, long-lived token from an app-connected Instagram
// account (there is no app-level Feature equivalent) -
// INSTAGRAM_DISCOVERY_ACCOUNT_ID/INSTAGRAM_DISCOVERY_ACCESS_TOKEN, obtained
// once via Samvid Lead Engine's /meta-page-check demo flow.
//
// When the Facebook Page chain doesn't yield a linked account (no Facebook
// match, or a Page that just never linked Instagram), a small set of
// plausible handles is tried as a fallback - each candidate is only accepted
// if the account's own display name passes the same compareBusinessNames
// check the Google/Facebook name search already relies on, and the result is
// flagged instagramMatchSource: "guessed" rather than "linked" so a false
// positive here can't be confused with the confirmed case. Capped at 6
// candidates: each is a real business_discovery call against Instagram's
// per-hour rate limit, so this isn't free.

import { compareBusinessNames } from "@/lib/prospecting/name-similarity";
import type { MetaPresenceSignal } from "@/lib/prospecting/types";

const PAGES_SEARCH_URL = "https://graph.facebook.com/v22.0/pages/search";
const GRAPH_BASE_URL = "https://graph.facebook.com/v22.0";
const MAX_GUESS_CANDIDATES = 6;

interface PageResult {
  name?: string;
  fan_count?: number;
  followers_count?: number;
  instagram_business_account?: { id?: string; username?: string };
}

interface PagesSearchResponse {
  data?: PageResult[];
  error?: { message?: string; code?: number };
}

interface BusinessDiscoveryFields {
  name?: string;
  username?: string;
  followers_count?: number;
}

interface BusinessDiscoveryResponse {
  business_discovery?: BusinessDiscoveryFields;
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

/**
 * Raw business_discovery call for one exact username. Returns null (not a
 * failure) when the account simply doesn't exist under that handle - Meta
 * returns a normal error for that case, indistinguishable from "wrong
 * guess," which is exactly what the guessing fallback needs to try the next
 * candidate rather than give up.
 */
async function fetchInstagramAccount(
  username: string,
): Promise<{ ok: true; data: BusinessDiscoveryFields } | { ok: false; reason: string }> {
  const accountId = process.env.INSTAGRAM_DISCOVERY_ACCOUNT_ID;
  const accessToken = process.env.INSTAGRAM_DISCOVERY_ACCESS_TOKEN;
  if (!accountId || !accessToken) {
    return { ok: false, reason: "INSTAGRAM_DISCOVERY_ACCOUNT_ID/INSTAGRAM_DISCOVERY_ACCESS_TOKEN not configured yet" };
  }

  const url = new URL(`${GRAPH_BASE_URL}/${accountId}`);
  url.searchParams.set("fields", `business_discovery.username(${username}){name,username,followers_count}`);
  url.searchParams.set("access_token", accessToken);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (err) {
    return { ok: false, reason: `Instagram Graph API request failed: ${(err as Error).message}` };
  }

  const data = (await response.json().catch(() => null)) as BusinessDiscoveryResponse | null;
  if (!response.ok || !data || data.error || !data.business_discovery) {
    return {
      ok: false,
      reason: data?.error?.message
        ? `Instagram Graph API error: ${data.error.message}`
        : `Instagram Graph API HTTP ${response.status}`,
    };
  }

  return { ok: true, data: data.business_discovery };
}

/** Word tokens for building candidate handles - deliberately simpler than
 * name-similarity.ts's tokenizer, since candidates just need to be plausible
 * strings to try, not a calibrated comparison. */
function handleTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Patterns observed on real accounts this session: plain, underscore-
 * prefixed ("_realtyshopee"), underscore/dot-separated, and ".official"-
 * suffixed ("nemnidhi.official"). Not exhaustive - just plausible enough to
 * be worth one API call each, with the name-match check catching the rest. */
function guessHandles(name: string): string[] {
  const tokens = handleTokens(name);
  if (tokens.length === 0) return [];
  const joined = tokens.join("");
  const candidates = [
    joined,
    `_${joined}`,
    tokens.join("_"),
    tokens.join("."),
    `${joined}.official`,
    `${joined}official`,
  ];
  return Array.from(new Set(candidates)).slice(0, MAX_GUESS_CANDIDATES);
}

interface InstagramLookupResult {
  found: boolean | null;
  followers: number | null;
  username: string | null;
  matchSource: "linked" | "guessed" | null;
  reason?: string;
}

/** Exact lookup for a username already confirmed via the Facebook Page's own
 * link - no name check needed, this handle came from Meta's own data. */
async function lookupLinkedInstagram(username: string): Promise<InstagramLookupResult> {
  const result = await fetchInstagramAccount(username);
  if (!result.ok) {
    return { found: null, followers: null, username: null, matchSource: null, reason: result.reason };
  }
  return {
    found: true,
    followers: result.data.followers_count ?? null,
    username,
    matchSource: "linked",
  };
}

/** Tries plausible handles in turn, accepting the first whose own display
 * name passes the same name-match discipline used everywhere else in this
 * pipeline. Stops at the first accepted match; does not keep searching for a
 * "better" one. */
async function guessInstagram(businessName: string): Promise<InstagramLookupResult> {
  const candidates = guessHandles(businessName);
  let lastReason: string | undefined;

  for (const candidate of candidates) {
    const result = await fetchInstagramAccount(candidate);
    if (!result.ok) {
      lastReason = result.reason;
      continue;
    }
    const match = compareBusinessNames(businessName, result.data.name ?? result.data.username ?? "");
    if (match.verdict !== "weak") {
      return {
        found: true,
        followers: result.data.followers_count ?? null,
        username: candidate,
        matchSource: "guessed",
      };
    }
  }

  return {
    found: null,
    followers: null,
    username: null,
    matchSource: null,
    reason: lastReason ?? "no guessed handle matched the business name",
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
  url.searchParams.set(
    "fields",
    "id,name,link,fan_count,followers_count,verification_status,instagram_business_account{id,username}",
  );
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
    // Facebook is unusable here, but Instagram guessing doesn't depend on
    // it, so still attempt that below.
    const ig = await guessInstagram(name);
    return {
      checked: ig.found !== null,
      facebookFound: null,
      facebookFollowers: null,
      instagramFound: ig.found,
      instagramFollowers: ig.followers,
      instagramUsername: ig.username,
      instagramMatchSource: ig.matchSource,
      reason:
        (data?.error?.message ? `Graph API error: ${data.error.message}` : `Graph API HTTP ${response.status}`) +
        (ig.reason ? ` | Instagram: ${ig.reason}` : ""),
      checkedAt: new Date(),
    };
  }

  const top = data.data?.[0];

  // Pages Search returns the nearest thing it can find rather than nothing -
  // same reasoning as the Google Places check, reusing the same comparator
  // rather than trusting the top result blindly.
  const match = top ? compareBusinessNames(name, top.name ?? "") : null;
  const facebookFound = top ? match!.verdict !== "weak" : false;

  // Prefer the Page's own declared link; fall back to guessing only when
  // that's not available (no Facebook match, or a Page that never linked
  // Instagram).
  const linkedUsername = facebookFound ? top?.instagram_business_account?.username : undefined;
  const ig = linkedUsername
    ? await lookupLinkedInstagram(linkedUsername)
    : await guessInstagram(name);

  const facebookReason =
    match?.verdict === "weak"
      ? `top result "${top?.name}" does not match the business name (similarity ${match.score?.toFixed(2)})`
      : match?.verdict === "unverifiable"
        ? "listing name could not be compared (different script); accepted rather than wrongly denied"
        : undefined;

  return {
    checked: true,
    facebookFound,
    facebookFollowers: facebookFound ? (top?.followers_count ?? top?.fan_count ?? null) : null,
    facebookPlaceName: top?.name ?? null,
    instagramFound: ig.found,
    instagramFollowers: ig.followers,
    instagramUsername: ig.username,
    instagramMatchSource: ig.matchSource,
    reason: facebookReason ?? ig.reason,
    checkedAt: new Date(),
  };
}

// Real Google Business check via the Places API (Text Search). Falls back
// to checked:false (not "not found") whenever the key is missing or the API
// call itself fails/is denied, so downstream classification can tell
// "not checked" apart from "checked, confirmed absent" - see classify.ts.

import { compareBusinessNames } from "@/lib/prospecting/name-similarity";
import type { GoogleBusinessSignal } from "@/lib/prospecting/types";

const PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";

interface PlacesResult {
  name?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
}

interface PlacesResponse {
  status?: string;
  error_message?: string;
  results?: PlacesResult[];
}

function notChecked(reason: string): GoogleBusinessSignal {
  return {
    checked: false,
    found: null,
    rating: null,
    reviewCount: null,
    reason,
    checkedAt: new Date(),
  };
}

export async function checkGoogleBusiness(
  name: string,
  district?: string | null,
  state?: string | null,
): Promise<GoogleBusinessSignal> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return notChecked("GOOGLE_PLACES_API_KEY not configured yet");
  }

  const query = [name, district, state].filter(Boolean).join(" ");
  const url = new URL(PLACES_TEXT_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("key", apiKey);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (err) {
    return notChecked(`Places API request failed: ${(err as Error).message}`);
  }

  if (!response.ok) {
    return notChecked(`Places API HTTP ${response.status}`);
  }

  const data = (await response.json()) as PlacesResponse;

  if (data.status === "ZERO_RESULTS") {
    return {
      checked: true,
      found: false,
      rating: null,
      reviewCount: null,
      checkedAt: new Date(),
    };
  }

  if (data.status !== "OK") {
    // REQUEST_DENIED, OVER_QUERY_LIMIT, INVALID_REQUEST, UNKNOWN_ERROR - none
    // of these mean "confirmed absent", so surface as not-checked rather
    // than guessing.
    return notChecked(
      `Places API status ${data.status}${data.error_message ? `: ${data.error_message}` : ""}`,
    );
  }

  const top = data.results && data.results[0];

  if (!top) {
    return { checked: true, found: false, rating: null, reviewCount: null, checkedAt: new Date() };
  }

  // A permanently-closed business under a similar name is a false positive,
  // not a match - verified live on a real lead.
  if (top.business_status === "CLOSED_PERMANENTLY") {
    return {
      checked: true,
      found: false,
      rating: null,
      reviewCount: null,
      placeName: top.name ?? null,
      reason: "top result is permanently closed",
      checkedAt: new Date(),
    };
  }

  // Places text search returns the nearest thing it can find rather than
  // nothing, so a real match has to be confirmed by name - otherwise a
  // business with no listing at all gets credited with one.
  const match = compareBusinessNames(name, top.name ?? "");
  const found = match.verdict !== "weak";

  return {
    checked: true,
    found,
    rating: found ? (top.rating ?? null) : null,
    reviewCount: found ? (top.user_ratings_total ?? null) : null,
    placeName: top.name ?? null,
    nameMatch: match.verdict,
    nameSimilarity: match.score,
    reason:
      match.verdict === "weak"
        ? `top result "${top.name}" does not match the business name (similarity ${match.score?.toFixed(2)})`
        : match.verdict === "unverifiable"
          ? "listing name could not be compared (different script); accepted rather than wrongly denied"
          : undefined,
    checkedAt: new Date(),
  };
}

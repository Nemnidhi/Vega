/**
 * Compares a business name against the name Google Places returned, so a
 * fuzzy nearby match isn't recorded as "this business has a Google profile".
 *
 * Places text search returns the closest thing it can find rather than
 * nothing, so without this check a business with no presence at all scores
 * a channel it doesn't have - inflating its tier and putting a false claim
 * in the report we send it.
 *
 * Calibrated against 1,022 real (lead name, place name) pairs from the live
 * database. Notes from that calibration, so the thresholds aren't re-guessed:
 *   - 55% of real pairs match exactly once legal suffixes are stripped.
 *   - Everything scoring below ~0.45 was, on inspection, a different
 *     business ("PAV GROUP" -> "Ghungroo seth", "ESTATEGATE" -> "Khetri
 *     Mahal, Jhunjhunu").
 *   - The 0.45-0.70 band is genuinely mixed: "MAGESTIC PROPERTY GROUP" ->
 *     "Majestic Property Group" is real, "BLUE BIRD DEVELOPERS" ->
 *     "Bluebird Infotech" is not. No threshold separates those, so the score
 *     is stored and the band is accepted rather than silently dropped.
 */

/** Corporate boilerplate that carries no identifying signal. */
const LEGAL_TOKENS = new Set([
  "private", "pvt", "ltd", "limited", "llp", "liability", "partnership", "firm",
  "company", "co", "associates", "huf", "proprietorship", "propritorship", "prop",
  "and", "the", "of", "enterprises", "enterprise", "group", "india", "indian",
]);

/** Business names mix digits and words freely: "five estate" / "5Estate". */
const DIGIT_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
};

export const DEFAULT_NAME_MATCH_THRESHOLD = 0.45;

export type NameMatchVerdict = "strong" | "weak" | "unverifiable";

export interface NameMatchResult {
  verdict: NameMatchVerdict;
  /** null when the names could not be compared at all. */
  score: number | null;
}

function hasLatin(value: string) {
  return /[a-z]/i.test(value);
}

function tokenize(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((token) => DIGIT_WORDS[token] ?? token)
    .filter((token) => token.length > 0 && !LEGAL_TOKENS.has(token));
}

function diceCoefficient<T>(a: Set<T>, b: Set<T>) {
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const item of a) if (b.has(item)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

function bigrams(value: string) {
  const result = new Set<string>();
  for (let i = 0; i < value.length - 1; i += 1) result.add(value.slice(i, i + 2));
  return result;
}

function acronym(tokens: string[]) {
  return tokens.map((token) => token[0]).join("");
}

/**
 * Catches a listing that abbreviates the business and adds a branch or city:
 * "JONES LANG LASALLE PROPERTY CONSULTANTS" -> "JLL Ahmedabad". Plain
 * acronym equality misses these because of the trailing token.
 *
 * Requires 3+ characters: two-letter prefixes collide far too easily.
 */
function abbreviationMatch(longTokens: string[], shortTokens: string[]) {
  if (longTokens.length < 3) return 0;
  const initials = acronym(longTokens);
  return shortTokens.some((token) => token.length >= 3 && initials.startsWith(token)) ? 1 : 0;
}

/**
 * 0 (nothing in common) to 1 (same business). Returns `unverifiable` when a
 * comparison is impossible - notably a Devanagari place name against a Latin
 * lead name, which is common in Indian listings. Refusing those would report
 * "no Google presence" to a business that plainly has one, which is the more
 * damaging error of the two.
 */
export function compareBusinessNames(leadName: string, placeName: string): NameMatchResult {
  if (!leadName?.trim() || !placeName?.trim()) {
    return { verdict: "unverifiable", score: null };
  }
  if (hasLatin(leadName) && !hasLatin(placeName)) {
    return { verdict: "unverifiable", score: null };
  }

  const leadTokens = tokenize(leadName);
  const placeTokens = tokenize(placeName);
  const leadJoined = leadTokens.join("");
  const placeJoined = placeTokens.join("");

  // Nothing but legal boilerplate on one side - no signal to compare.
  if (!leadJoined || !placeJoined) {
    return { verdict: "unverifiable", score: null };
  }

  // Spacing differences ("YASHVINEXUS" / "Yashvi Nexus") and Places' habit of
  // appending marketing tails ("... - Real Estate Consultant in Ahmedabad").
  const containment = leadJoined.includes(placeJoined) || placeJoined.includes(leadJoined) ? 1 : 0;
  // "JANKI DEVI BUILDCON" / "JDB Group".
  const initialism =
    acronym(leadTokens) === placeJoined ||
    acronym(placeTokens) === leadJoined ||
    (leadTokens.length > 1 && acronym(leadTokens) === acronym(placeTokens))
      ? 1
      : 0;

  const score = Math.max(
    diceCoefficient(new Set(leadTokens), new Set(placeTokens)),
    diceCoefficient(bigrams(leadJoined), bigrams(placeJoined)),
    containment,
    initialism,
    abbreviationMatch(leadTokens, placeTokens),
    abbreviationMatch(placeTokens, leadTokens),
  );

  return { verdict: score >= readThreshold() ? "strong" : "weak", score };
}

function readThreshold() {
  const raw = process.env.GOOGLE_NAME_MATCH_THRESHOLD;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : DEFAULT_NAME_MATCH_THRESHOLD;
}

// Shared presentation for the audit tier, so the list and the detail view
// never disagree about what "Tier A" means or what colour it is.
import type { ProspectingTier } from "@/types/lead";

export const TIER_LABEL: Record<ProspectingTier, string> = {
  A: "No digital presence found",
  B: "Minimal digital presence",
  C: "Partial digital presence",
  D: "Strong digital presence",
};

/**
 * Tier A is the *best* prospect for us (no presence at all = most to sell)
 * even though it is the worst result for them. Colour reflects opportunity,
 * matching how the rest of the dashboard reads.
 */
export const TIER_VARIANT: Record<ProspectingTier, "danger" | "warning" | "accent" | "neutral"> = {
  A: "danger",
  B: "warning",
  C: "accent",
  D: "neutral",
};

export const TIER_ORDER: ProspectingTier[] = ["A", "B", "C", "D"];

export function isTier(value: unknown): value is ProspectingTier {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

export function humanizeKey(value?: string | null) {
  if (!value) return "";
  return value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Confidence in the *industry* classification, not the tier. */
export const CONFIDENCE_VARIANT: Record<string, "success" | "warning" | "accent" | "neutral"> = {
  explicit: "success",
  high: "accent",
  low: "warning",
  unknown: "neutral",
};

export const CONFIDENCE_HELP: Record<string, string> = {
  explicit: "The source named this sector directly.",
  high: "Matched from a business-category field or statutory registration.",
  low: "Guessed from the company name only - worth a human check.",
  unknown: "Could not be determined; the report will use generic copy.",
};

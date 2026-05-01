import type { LeadCategory, LeadPriorityBand, LeadSource, LeadUrgency } from "@/types/lead";

const sourceWeight: Record<LeadSource, number> = {
  referral: 24,
  partner: 22,
  website: 16,
  event: 12,
  paid_ads: 10,
  cold_outreach: 8,
  other: 6,
};

const categoryWeight: Record<LeadCategory, number> = {
  retainer_enterprise: 30,
  infrastructure: 26,
  legal_automation: 22,
  software_request: 18,
  other: 10,
};

const urgencyWeight: Record<LeadUrgency, number> = {
  critical: 26,
  high: 18,
  medium: 12,
  low: 6,
};

function budgetWeight(min?: number, max?: number) {
  if (!min && !max) {
    return 6;
  }
  const midpoint = ((min ?? 0) + (max ?? min ?? 0)) / 2;

  if (midpoint >= 2500000) return 30;
  if (midpoint >= 1200000) return 24;
  if (midpoint >= 500000) return 18;
  if (midpoint >= 200000) return 12;
  return 7;
}

export function deriveLeadPriorityBand(score: number): LeadPriorityBand {
  if (score >= 80) return "heavy_artillery";
  if (score >= 50) return "standard_sales";
  return "volume_pipeline";
}

export function scoreLead(input: {
  source: LeadSource;
  category: LeadCategory;
  urgency: LeadUrgency;
  budget?: { min: number; max: number };
}) {
  const score =
    sourceWeight[input.source] +
    categoryWeight[input.category] +
    urgencyWeight[input.urgency] +
    budgetWeight(input.budget?.min, input.budget?.max);

  const normalizedScore = Math.min(100, Math.max(0, score));
  const priorityBand = deriveLeadPriorityBand(normalizedScore);
  const priorityFlag = priorityBand === "heavy_artillery";

  return {
    score: normalizedScore,
    priorityBand,
    priorityFlag,
  };
}

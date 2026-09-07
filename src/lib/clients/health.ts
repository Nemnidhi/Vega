// First-pass account health: computed entirely from what Vega already has today - the
// dashboardPlan trend (from the Dashboard->Vega feed) and how recently anything was heard at
// all. Deliberately not a real usage/activity signal yet, since only plan_changed events exist
// on the feed right now - this is honest about that limit rather than pretending to know more
// than it does. Extend once a richer usage event exists on the feed (see nemnidhi-ecosystem-map
// notes on the Dashboard->Vega feed for the planned next event type).

const TIER_RANK: Record<string, number> = { basic: 0, medium: 1, pro: 2, custom: 3 };

export type AccountHealthStatus = "no_signal" | "downgraded" | "upgraded" | "active";

export interface AccountHealth {
  status: AccountHealthStatus;
  label: string;
  detail: string;
}

export interface AccountHealthInput {
  dashboardOrganizationId?: string | null;
  dashboardLastEventAt?: Date | string | null;
  /** The most recent plan_changed event's details, if any. */
  latestPlanChange?: { plan?: string; previousPlan?: string } | null;
  now?: Date;
  staleAfterDays?: number;
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export function computeAccountHealth({
  dashboardOrganizationId,
  dashboardLastEventAt,
  latestPlanChange,
  now = new Date(),
  staleAfterDays = 14,
}: AccountHealthInput): AccountHealth {
  if (!dashboardOrganizationId) {
    return { status: "no_signal", label: "Not linked", detail: "No Dashboard workspace linked yet." };
  }

  if (!dashboardLastEventAt) {
    return { status: "no_signal", label: "No signal yet", detail: "Linked, but nothing received from Dashboard yet." };
  }

  const daysSince = daysBetween(new Date(dashboardLastEventAt), now);

  if (daysSince > staleAfterDays) {
    return {
      status: "no_signal",
      label: "No recent signal",
      detail: `Last heard from Dashboard ${daysSince} day${daysSince === 1 ? "" : "s"} ago.`,
    };
  }

  const plan = latestPlanChange?.plan;
  const previousPlan = latestPlanChange?.previousPlan;
  if (plan && previousPlan && plan in TIER_RANK && previousPlan in TIER_RANK) {
    if (TIER_RANK[plan] < TIER_RANK[previousPlan]) {
      return { status: "downgraded", label: "Plan downgraded", detail: `Moved from ${previousPlan} to ${plan}.` };
    }
    if (TIER_RANK[plan] > TIER_RANK[previousPlan]) {
      return { status: "upgraded", label: "Plan upgraded", detail: `Moved from ${previousPlan} to ${plan} - a real upsell signal.` };
    }
  }

  return {
    status: "active",
    label: "Active",
    detail: `Last heard from Dashboard ${daysSince} day${daysSince === 1 ? "" : "s"} ago.`,
  };
}

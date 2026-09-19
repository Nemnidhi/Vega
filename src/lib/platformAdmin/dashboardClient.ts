import { getServerEnv } from "@/lib/env/server";
import { ApiError } from "@/lib/api/responses";

// Server-to-server client for Dashboard-WhatsApp's /api/platform-admin/* routes (master plan
// Phase 7). Mirrors the shape of Dashboard-WhatsApp's own vegaIntegration.js (timeout, non-2xx
// handling, "not configured" degrades cleanly rather than throwing where the caller can show a
// real empty/error state instead of crashing a page) - the reverse direction of that same
// relationship. Every call here is made from a server-only context (a Server Component page or
// an internal API route already gated by requireRoleAccess/assertRoleAccess), never from the
// browser directly.

export type DashboardOrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  billingStatus: string;
  workspaceCount: number;
  memberCount: number;
  createdAt: string;
};

export type DashboardUsageMetric = {
  metric: string;
  count: number;
  limit: number | null;
  ratio: number | null;
  softWarn: boolean;
  exceeded: boolean;
};

export type DashboardOrganizationDetail = {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    billingStatus: string;
    createdAt: string;
  };
  entitlements: {
    plan: string;
    normalized: boolean;
    capabilities: Array<{ key: string; label: string; description: string; minTier: string; enabled: boolean }>;
  };
  usage: { period: string; metrics: DashboardUsageMetric[] };
  workspaces: Array<{ id: string; name: string; slug: string; businessCategory: string; createdAt: string }>;
  members: Array<{ id: string; name: string; email: string; workspace: string }>;
  summary: { templates: number; automationFlows: number; campaigns: number; whatsappAccounts: number };
  whatsappAccounts: Array<{ id: string; displayName: string; phoneNumber: string; status: string; workspace: string }>;
};

export type DashboardIndustryPack = {
  id: string;
  key: string;
  label: string;
  industry: string;
  description: string;
  templateCount: number;
};

// Extends Vega's own ApiError (not a bare Error) so handleApiError (src/lib/api/responses.ts)
// forwards Dashboard-WhatsApp's real HTTP status code to the browser - a 404 stays a 404, not a
// generic 400 from handleApiError's message-substring fallback.
class DashboardApiError extends ApiError {}

function requireConfig() {
  const { DASHBOARD_API_URL, DASHBOARD_INTEGRATION_SECRET } = getServerEnv();
  if (!DASHBOARD_API_URL || !DASHBOARD_INTEGRATION_SECRET) {
    throw new Error("Not configured: DASHBOARD_API_URL/DASHBOARD_INTEGRATION_SECRET is unset");
  }
  return { baseUrl: DASHBOARD_API_URL, secret: DASHBOARD_INTEGRATION_SECRET };
}

async function callDashboardApi<T>(
  path: string,
  { method = "GET", body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { baseUrl, secret } = requireConfig();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${baseUrl}/api/platform-admin${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-integration-secret": secret,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new DashboardApiError(payload?.message || `Dashboard-WhatsApp returned ${response.status}`, response.status);
    }
    return payload.data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchDashboardOrganizations() {
  return callDashboardApi<DashboardOrganizationSummary[]>("/organizations");
}

export async function fetchDashboardOrganizationDetail(organizationId: string) {
  return callDashboardApi<DashboardOrganizationDetail>(`/organizations/${organizationId}`);
}

export async function updateDashboardOrganization(
  organizationId: string,
  updates: { plan?: string; billingStatus?: string },
) {
  return callDashboardApi<{ id: string; plan: string; billingStatus: string }>(`/organizations/${organizationId}`, {
    method: "PATCH",
    body: updates,
  });
}

export async function fetchDashboardIndustryPacks() {
  return callDashboardApi<DashboardIndustryPack[]>("/industry-packs");
}

export async function provisionDashboardOrganization(
  organizationId: string,
  { workspaceId, industryPackKey }: { workspaceId: string; industryPackKey: string },
) {
  return callDashboardApi<{ industryPackKey: string; workspaceId: string; templatesCreated: Array<{ id: string; name: string }> }>(
    `/organizations/${organizationId}/provision`,
    { method: "POST", body: { workspaceId, industryPackKey } },
  );
}

export { DashboardApiError };

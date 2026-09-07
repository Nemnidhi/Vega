import { getServerEnv } from "@/lib/env/server";
import { secretsMatch } from "@/lib/auth/secrets";

// Server-to-server only - Dashboard-WhatsApp's backend calls every /api/integrations/* route
// directly, no browser involved, authenticated with this shared secret header instead of the
// session cookie every staff/portal route uses. Extracted out of dashboard-events/route.ts (the
// first caller) so the meetings/office-hours routes added alongside it don't each re-implement
// the same check - same reasoning client-portal-actor.ts already applied to the client-portal
// route family. Uses secretsMatch (constant-time) rather than !== - the session/invite-token
// verifiers already compare this way, server-to-server secret headers should too.
export function assertValidDashboardSecret(request: Request) {
  const { DASHBOARD_INTEGRATION_SECRET } = getServerEnv();
  if (!DASHBOARD_INTEGRATION_SECRET) {
    throw new Error("Not configured: DASHBOARD_INTEGRATION_SECRET is unset");
  }

  const provided = request.headers.get("x-integration-secret");
  if (!secretsMatch(provided, DASHBOARD_INTEGRATION_SECRET)) {
    throw new Error("Unauthorized: invalid integration secret");
  }
}

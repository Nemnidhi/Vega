import { getServerEnv } from "@/lib/env/server";
import { UserModel } from "@/models";
import type { AuthSession } from "@/lib/auth/session";

// Server-to-server only - nemnidhi.com's own backend calls /api/client-portal/* on behalf of
// its own logged-in client users, authenticated with a shared secret header rather than the
// session cookie every other route here uses. Same shape as the Dashboard integration's
// assertValidSecret (src/app/api/integrations/dashboard-events/route.ts).
export function assertValidClientPortalSecret(request: Request) {
  const { CLIENT_PORTAL_INTEGRATION_SECRET } = getServerEnv();
  if (!CLIENT_PORTAL_INTEGRATION_SECRET) {
    throw new Error("Not configured: CLIENT_PORTAL_INTEGRATION_SECRET is unset");
  }

  const provided = request.headers.get("x-client-portal-secret");
  if (provided !== CLIENT_PORTAL_INTEGRATION_SECRET) {
    throw new Error("Unauthorized: invalid client portal secret");
  }
}

/**
 * The shared secret only proves "this call came from the website's backend" - it says nothing
 * about which client is asking. The website asserts a clientUserId (from its own session cookie,
 * established at login/signup/activate); this re-derives a real AuthSession from the database so
 * every existing client route's ownership checks (resolveClientLeadId, lead/proposal ownership
 * matches, etc.) run exactly as they do for a cookie-based session, rather than trusting the
 * caller's claim at face value.
 */
export async function resolveClientPortalActor(clientUserId: string): Promise<AuthSession> {
  const user = await UserModel.findById(clientUserId).lean();
  if (!user || user.role !== "client" || user.status !== "active") {
    throw new Error("Unauthorized: invalid client");
  }

  return {
    userId: String(user._id),
    email: user.email,
    role: "client",
    fullName: user.fullName,
  };
}

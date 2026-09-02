import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/token";

/**
 * Request-level backstop for the API surface.
 *
 * Authorization lives in the route handlers, and still does - each one resolves the actor and
 * checks its own role rules. The problem this solves is that the check was entirely opt-in
 * across 137 route files: a handler that simply forgot to call getActorContext was silently
 * public, with nothing in the type system or the tests to catch it. That is how the client
 * vault ended up readable across accounts.
 *
 * So this inverts the default. Everything under /api requires a validly signed, unexpired
 * session token unless it is on PUBLIC_API_ROUTES below, which is the complete list of
 * endpoints that are meant to be reachable without one.
 *
 * Two deliberate limits:
 *
 * - It verifies the token's signature and expiry, nothing more. Whether the account still
 *   exists, is still active, and still holds the role in the token is a database question,
 *   and per the Next docs a proxy should not be reaching for shared connections or globals.
 *   getCurrentSession does that authoritative check on every request that gets through here.
 * - It never grants access. Passing this only means "you have a real session"; what that
 *   session is allowed to do is still entirely the handler's decision.
 */

/**
 * Endpoints reachable without a session, and why. Anything not listed is closed by default -
 * adding a genuinely public route means adding it here, which is a visible decision in review
 * rather than an omission.
 */
const PUBLIC_API_ROUTES = [
  "/api/health", // liveness probe
  "/api/auth/login", // staff login - issues the session
  "/api/auth/logout", // clearing a cookie needs no valid cookie
  "/api/auth/session", // reports whether a session exists; handles "none" itself
  "/api/auth/client/login",
  "/api/auth/client/signup",
  "/api/auth/client/activate",
  "/api/webhooks/meta-leads", // authenticated by X-Hub-Signature-256
] as const;

/** Prefixes whose whole subtree is public. */
const PUBLIC_API_PREFIXES = [
  "/api/public/", // website-facing capture and catalogue reads, origin-gated
  "/api/client-portal/", // shared-secret, server-to-server from the website backend
  "/api/integrations/", // shared-secret, server-to-server
] as const;

function isPublicApiRoute(pathname: string) {
  if ((PUBLIC_API_ROUTES as readonly string[]).includes(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Headers a client must never be able to set, because something downstream might believe
 * them. getActorContext used to accept x-user-id / x-user-role as an identity fallback; that
 * fallback is gone, but stripping them here means a future reintroduction cannot be turned
 * into an authentication bypass by anyone who can send a header.
 */
const SPOOFABLE_IDENTITY_HEADERS = ["x-user-id", "x-user-role"] as const;

function withStrippedIdentityHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  let stripped = false;

  for (const header of SPOOFABLE_IDENTITY_HEADERS) {
    if (headers.has(header)) {
      headers.delete(header);
      stripped = true;
    }
  }

  if (!stripped) return NextResponse.next();
  return NextResponse.next({ request: { headers } });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicApiRoute(pathname)) {
    return withStrippedIdentityHeaders(request);
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }

  return withStrippedIdentityHeaders(request);
}

export const config = {
  matcher: "/api/:path*",
};

import { cache } from "react";
import { cookies } from "next/headers";
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { createSessionToken, verifySessionToken } from "@/lib/auth/token";
import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/models";
import type { UserRole } from "@/types/user";

export interface AuthSession {
  userId: string;
  email: string;
  role: UserRole;
  fullName?: string;
}

/**
 * Resolve the caller's session from the cookie.
 *
 * The token's signature and expiry are necessary but not sufficient: it also carries the
 * account's role and a session version, both of which are a snapshot from login time. A
 * signature check alone meant a user who had been deactivated, demoted or deleted kept full
 * access for the remaining life of their cookie - up to seven days. So this also reads the
 * account and rejects the token when the account is gone, no longer active, or has been
 * changed in a way that bumped `sessionVersion`.
 *
 * The role is taken from the database rather than the token, so a demotion applies to the
 * caller's very next request instead of the next time they log in.
 *
 * Wrapped in React's `cache` so the added read happens once per request even though a page
 * render can reach this from a layout, the page itself and several server components - the
 * memoization is per render pass, so it never carries a session between requests or users.
 */
export const getCurrentSession = cache(async (): Promise<AuthSession | null> => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const payload = verifySessionToken(sessionToken);
  if (!payload) {
    return null;
  }

  await connectToDatabase();
  const user = await UserModel.findById(payload.sub)
    .select("email fullName role status sessionVersion")
    .lean();

  if (!user || user.status !== "active") {
    return null;
  }

  // Rows predating this field have no value; missing reads as 0, which is what tokens
  // minted before the field existed also carry.
  if ((user.sessionVersion ?? 0) !== (payload.sessionVersion ?? 0)) {
    return null;
  }

  return {
    userId: String(user._id),
    email: user.email,
    role: user.role as UserRole,
    fullName: user.fullName,
  };
});

export function buildSessionCookieValue(input: AuthSession & { sessionVersion?: number }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: input.userId,
    email: input.email,
    role: input.role,
    fullName: input.fullName,
    sessionVersion: input.sessionVersion ?? 0,
    iat: now,
    exp: now + AUTH_COOKIE_MAX_AGE_SECONDS,
  };

  return createSessionToken(payload);
}

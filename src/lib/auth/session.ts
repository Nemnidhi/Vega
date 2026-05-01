import { cookies } from "next/headers";
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { createSessionToken, verifySessionToken } from "@/lib/auth/token";
import type { UserRole } from "@/types/user";

export interface AuthSession {
  userId: string;
  email: string;
  role: UserRole;
  fullName?: string;
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const payload = verifySessionToken(sessionToken);
  if (!payload) {
    return null;
  }

  return {
    userId: payload.sub,
    email: payload.email,
    role: payload.role,
    fullName: payload.fullName,
  };
}

export function buildSessionCookieValue(input: AuthSession) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: input.userId,
    email: input.email,
    role: input.role,
    fullName: input.fullName,
    iat: now,
    exp: now + AUTH_COOKIE_MAX_AGE_SECONDS,
  };

  return createSessionToken(payload);
}

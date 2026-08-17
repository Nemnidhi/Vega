// Accepts a staff-issued client-portal invite (see
// /api/leads/[id]/invite-client) and turns it into a real login - either a
// brand-new client User, or reuses one if this email already has an
// account (e.g. a second lead for a business that's already onboarded).

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { activateClientInviteSchema } from "@/lib/validation/client-auth";
import { activateClientInvite } from "@/lib/auth/client-portal-credentials";
import { buildSessionCookieValue } from "@/lib/auth/session";
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { handleApiError } from "@/lib/api/responses";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const payload = activateClientInviteSchema.parse(await request.json());
    const identity = await activateClientInvite(payload);

    const sessionValue = buildSessionCookieValue({
      userId: identity.id,
      email: identity.email,
      role: identity.role,
      fullName: identity.fullName,
    });

    const response = NextResponse.json({
      success: true,
      data: { user: identity },
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: sessionValue,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { clientLoginSchema } from "@/lib/validation/client-auth";
import { verifyClientCredentials } from "@/lib/auth/client-portal-credentials";
import { buildSessionCookieValue } from "@/lib/auth/session";
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { handleApiError } from "@/lib/api/responses";
import { assertAuthRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const payload = clientLoginSchema.parse(await request.json());
    await assertAuthRateLimit(request, "client_login", payload.email);
    const identity = await verifyClientCredentials(payload);

    const sessionValue = buildSessionCookieValue({
      userId: identity.id,
      email: identity.email,
      role: identity.role,
      fullName: identity.fullName,
      sessionVersion: identity.sessionVersion,
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

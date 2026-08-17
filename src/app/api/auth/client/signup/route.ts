import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { clientSignupSchema } from "@/lib/validation/client-auth";
import { createClientSignup } from "@/lib/auth/client-portal-credentials";
import { buildSessionCookieValue } from "@/lib/auth/session";
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { handleApiError } from "@/lib/api/responses";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const payload = clientSignupSchema.parse(await request.json());
    const identity = await createClientSignup(payload);

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

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/models";
import { clientSignupSchema } from "@/lib/validation/client-auth";
import { hashPassword } from "@/lib/auth/password";
import { buildSessionCookieValue } from "@/lib/auth/session";
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { fail, handleApiError } from "@/lib/api/responses";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const payload = clientSignupSchema.parse(await request.json());
    const normalizedEmail = payload.email.toLowerCase();

    const existingUser = await UserModel.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      return fail("Account already exists with this email.", 409);
    }

    const user = await UserModel.create({
      fullName: payload.fullName,
      email: normalizedEmail,
      role: "client",
      passwordHash: hashPassword(payload.password),
      status: "active",
    });

    const sessionValue = buildSessionCookieValue({
      userId: String(user._id),
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: String(user._id),
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
      },
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

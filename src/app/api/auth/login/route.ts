import { z } from "zod";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { buildSessionCookieValue } from "@/lib/auth/session";
import { UserModel } from "@/models";
import { handleApiError } from "@/lib/api/responses";

const roleSchema = z.enum([
  "admin",
  "partner",
  "sales",
  "project_manager",
  "developer",
  "client",
]);

const loginSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(2).max(120).optional(),
  role: roleSchema,
});

function defaultNameFromEmail(email: string) {
  const value = email.split("@")[0] ?? "User";
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const payload = loginSchema.parse(await request.json());

    let user = await UserModel.findOne({ email: payload.email.toLowerCase() });
    if (!user) {
      user = await UserModel.create({
        email: payload.email.toLowerCase(),
        fullName: payload.fullName ?? defaultNameFromEmail(payload.email),
        role: payload.role,
        status: "active",
      });
    } else if (user.status !== "active") {
      user.status = "active";
      await user.save();
    }

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

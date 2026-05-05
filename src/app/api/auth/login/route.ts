import { z } from "zod";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  LOGIN_ROLES,
} from "@/lib/auth/constants";
import { buildSessionCookieValue } from "@/lib/auth/session";
import { UserModel } from "@/models";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { fail, handleApiError } from "@/lib/api/responses";

const roleSchema = z.enum(LOGIN_ROLES);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
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
    const normalizedEmail = payload.email.toLowerCase();

    let user = await UserModel.findOne({ email: normalizedEmail });
    if (!user) {
      user = await UserModel.create({
        email: normalizedEmail,
        fullName: payload.fullName ?? defaultNameFromEmail(payload.email),
        role: payload.role,
        passwordHash: hashPassword(payload.password),
        status: "active",
        lastLoginAt: new Date(),
      });
    } else if (user.role !== payload.role) {
      throw new Error("This email is mapped to a different role.");
    } else if (!LOGIN_ROLES.includes(user.role as (typeof LOGIN_ROLES)[number])) {
      throw new Error("This role is not allowed to login.");
    } else {
      if (!user.passwordHash) {
        user.passwordHash = hashPassword(payload.password);
      } else if (!verifyPassword(payload.password, user.passwordHash)) {
        return fail("Invalid email or password.", 401);
      }

      if (user.status !== "active") {
        user.status = "active";
      }

      user.lastLoginAt = new Date();
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

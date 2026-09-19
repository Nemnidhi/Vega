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
import { assertAuthRateLimit } from "@/lib/rate-limit";

const roleSchema = z.enum(LOGIN_ROLES);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(2).max(120).optional(),
  /**
   * Optional, and only still accepted so the old per-role portal pages keep
   * working. The single sign-in form omits it: which portal someone happens to
   * be looking at is not an authentication fact, and making people pick their
   * own role was only ever a way to get the answer wrong.
   */
  role: roleSchema.optional(),
  /**
   * Unchecked gives a session cookie that dies with the browser, which is what
   * people expect on a shared or borrowed machine. Checked keeps the existing
   * persistent window.
   */
  rememberMe: z.boolean().optional(),
});

/** Roles that may sign in at all. Clients included - they use the same form. */
const SIGN_IN_ROLES = [...LOGIN_ROLES, "client"] as const;

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

    await assertAuthRateLimit(request, "staff_login", normalizedEmail);

    let user = await UserModel.findOne({ email: normalizedEmail });
    if (!user) {
      const staffAccountCount = await UserModel.countDocuments({
        role: { $in: LOGIN_ROLES },
      });
      // First run only: with no staff at all there is nothing to protect, and
      // somebody has to be able to get in. Once one staff account exists this can
      // never fire again.
      const canBootstrapFirstAdmin = staffAccountCount === 0;

      if (!canBootstrapFirstAdmin) {
        return fail("Invalid email or password.", 401);
      }

      user = await UserModel.create({
        email: normalizedEmail,
        fullName: payload.fullName ?? defaultNameFromEmail(payload.email),
        role: "admin",
        passwordHash: hashPassword(payload.password),
        status: "active",
        lastLoginAt: new Date(),
      });
    } else {
      // A role in the body now narrows rather than identifies: the old portal
      // pages still send one, and it must match. The universal form sends none,
      // and the account's own role decides where they land.
      if (payload.role && user.role !== payload.role) {
        return fail("Invalid email or password.", 401);
      }
      if (!SIGN_IN_ROLES.includes(user.role as (typeof SIGN_IN_ROLES)[number])) {
        return fail("This account cannot sign in here.", 403);
      }
      if (user.status !== "active") {
        return fail("This account is not active. Please contact admin.", 403);
      }
      if (!user.passwordHash) {
        return fail("Password is not set for this account. Please contact admin.", 403);
      }
      if (!verifyPassword(payload.password, user.passwordHash)) {
        return fail("Invalid email or password.", 401);
      }

      user.lastLoginAt = new Date();
      await user.save();
    }

    const sessionValue = buildSessionCookieValue({
      userId: String(user._id),
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      sessionVersion: user.sessionVersion ?? 0,
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
      // Omitting maxAge makes it a session cookie - gone when the browser closes.
      ...(payload.rememberMe === false ? {} : { maxAge: AUTH_COOKIE_MAX_AGE_SECONDS }),
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

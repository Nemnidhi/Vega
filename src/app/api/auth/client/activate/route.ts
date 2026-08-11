// Accepts a staff-issued client-portal invite (see
// /api/leads/[id]/invite-client) and turns it into a real login - either a
// brand-new client User, or reuses one if this email already has an
// account (e.g. a second lead for a business that's already onboarded).

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ClientModel, ClientInviteModel, LeadModel, UserModel } from "@/models";
import { activateClientInviteSchema } from "@/lib/validation/client-auth";
import { verifyInviteToken, hashInviteToken } from "@/lib/auth/invite-token";
import { hashPassword } from "@/lib/auth/password";
import { buildSessionCookieValue } from "@/lib/auth/session";
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { logActivity } from "@/lib/activity/logging";
import { fail, handleApiError } from "@/lib/api/responses";
import type { Lead } from "@/types/lead";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const payload = activateClientInviteSchema.parse(await request.json());

    const tokenPayload = verifyInviteToken(payload.token);
    if (!tokenPayload) {
      return fail("This invite link is invalid or has expired.", 400);
    }

    const invite = await ClientInviteModel.findById(tokenPayload.inviteId);
    if (!invite || invite.status !== "pending") {
      return fail("This invite is no longer valid - ask a team member to resend it.", 400);
    }
    if (invite.tokenHash !== hashInviteToken(payload.token) || invite.email !== tokenPayload.email) {
      return fail("This invite link is invalid.", 400);
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      invite.status = "expired";
      await invite.save();
      return fail("This invite has expired - ask a team member to resend it.", 400);
    }

    const lead = await LeadModel.findById(invite.leadId).lean<Lead | null>();
    if (!lead) {
      return fail("The lead this invite was for no longer exists.", 404);
    }

    let user = await UserModel.findOne({ email: invite.email });
    if (user && user.role !== "client") {
      return fail("This email belongs to a staff account, not a client.", 409);
    }

    if (!user) {
      const fullName = payload.fullName || lead.contactName || lead.title;
      user = await UserModel.create({
        fullName,
        email: invite.email,
        role: "client",
        phone: lead.phone || undefined,
        passwordHash: hashPassword(payload.password),
        status: "active",
      });
    }

    await ClientModel.findOneAndUpdate(
      { primaryContactEmail: invite.email },
      { $set: { leadId: invite.leadId } },
    );

    invite.status = "accepted";
    invite.acceptedAt = new Date();
    invite.createdClientUserId = user._id;
    await invite.save();

    await logActivity({
      action: "client_portal_activated",
      actorId: String(user._id),
      entityType: "lead",
      entityId: String(invite.leadId),
      details: { email: invite.email },
    });

    const sessionValue = buildSessionCookieValue({
      userId: String(user._id),
      email: user.email,
      role: "client",
      fullName: user.fullName,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: String(user._id),
          fullName: user.fullName,
          email: user.email,
          role: "client",
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

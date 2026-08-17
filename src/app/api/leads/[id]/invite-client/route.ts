// Staff-initiated client-portal invite for a lead, any source - unlike the
// self-serve website signup (clientSignupSchema), which only ever
// auto-links source:"website" leads. Cold-outreach leads have no way to
// discover that signup page, so someone on staff has to send them a link.

import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ClientModel, ClientInviteModel, LeadModel, UserModel } from "@/models";
import { inviteClientSchema } from "@/lib/validation/client-auth";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { createInviteToken, hashInviteToken } from "@/lib/auth/invite-token";
import { sendClientInviteEmail } from "@/lib/notifications/send-client-invite-email";
import { logActivity } from "@/lib/activity/logging";
import { handleApiError, fail, ok } from "@/lib/api/responses";
import type { Lead } from "@/types/lead";

const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const { id: leadId } = await params;
    const payload = inviteClientSchema.parse(await request.json().catch(() => ({})));

    const lead = await LeadModel.findById(leadId).lean<Lead | null>();
    if (!lead) {
      return fail("Lead not found", 404);
    }

    const email = (payload.email || lead.email || "").toLowerCase().trim();
    if (!email) {
      return fail("This lead has no email on file - add one before inviting", 422);
    }

    const existingUser = await UserModel.findOne({ email }).lean();
    if (existingUser && existingUser.role !== "client") {
      return fail("This email belongs to a staff account, not a client.", 409);
    }

    // Re-inviting replaces rather than duplicates - the partial unique index
    // on {leadId, status:"pending"} is the safety net, this is the normal path.
    await ClientInviteModel.updateMany(
      { leadId, status: "pending" },
      { $set: { status: "revoked" } },
    );

    await ClientModel.findOneAndUpdate(
      { primaryContactEmail: email },
      {
        $set: {
          legalName: lead.title,
          primaryContactName: lead.contactName || lead.title,
          primaryContactEmail: email,
          primaryContactPhone: lead.phone || undefined,
          leadId: lead._id,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const inviteId = new Types.ObjectId();
    const token = createInviteToken(
      { inviteId: String(inviteId), leadId: String(lead._id), email, purpose: "client-invite" },
      INVITE_TTL_SECONDS,
    );

    await ClientInviteModel.create({
      _id: inviteId,
      leadId: lead._id,
      email,
      invitedByUserId: actor.userId,
      tokenHash: hashInviteToken(token),
      status: "pending",
      expiresAt: new Date(Date.now() + INVITE_TTL_SECONDS * 1000),
    });

    // Clients activate on nemnidhi.com/portal now, not Vega's own /client/activate -
    // Vega is staff-only per its own documented boundary. APP_BASE_URL/NEXT_PUBLIC_APP_URL
    // stay pointed at Vega itself (assignment-email.ts's staff-facing links depend on that),
    // so this is a separate, narrowly-scoped env var instead of repointing those.
    const clientPortalBaseUrl = (process.env.CLIENT_PORTAL_BASE_URL || "https://nemnidhi.com").replace(
      /\/$/,
      "",
    );
    const activationLink = `${clientPortalBaseUrl}/portal/activate?token=${token}`;

    let emailSent = false;
    try {
      const result = await sendClientInviteEmail({
        to: email,
        businessName: lead.title,
        activationLink,
      });
      emailSent = result.sent;
    } catch {
      // Invite still exists and the link still works even if the send
      // itself failed - staff can copy activationLink from the response.
      emailSent = false;
    }

    await logActivity({
      action: "client_portal_invited",
      actorId: actor.userId,
      entityType: "lead",
      entityId: String(lead._id),
      details: { email, inviteId: String(inviteId), emailSent },
    });

    return ok({ email, inviteId: String(inviteId), emailSent, activationLink });
  } catch (error) {
    return handleApiError(error);
  }
}

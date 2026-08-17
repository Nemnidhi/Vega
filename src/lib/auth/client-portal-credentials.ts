import { ClientModel, ClientInviteModel, ClientOnboardingModel, LeadModel, UserModel } from "@/models";
import type { clientSignupSchema, clientLoginSchema, activateClientInviteSchema } from "@/lib/validation/client-auth";
import type { z } from "zod";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { verifyInviteToken, hashInviteToken } from "@/lib/auth/invite-token";
import { logActivity } from "@/lib/activity/logging";
import { ApiError } from "@/lib/api/responses";
import type { Lead } from "@/types/lead";

/**
 * Business logic shared by the cookie-session client-auth routes
 * (src/app/api/auth/client/{login,signup,activate}/route.ts) and the
 * shared-secret /api/client-portal/auth/* routes the website calls - the
 * two kinds of routes only differ in what they do with the resulting
 * identity (set a Vega cookie vs return JSON for the website to wrap in
 * its own session), never in the underlying account logic.
 */
export type ClientPortalIdentity = {
  id: string;
  fullName: string;
  email: string;
  role: "client";
};

export async function verifyClientCredentials(
  payload: z.infer<typeof clientLoginSchema>,
): Promise<ClientPortalIdentity> {
  const normalizedEmail = payload.email.toLowerCase();

  const user = await UserModel.findOne({ email: normalizedEmail });
  if (!user || user.role !== "client" || user.status !== "active" || !user.passwordHash) {
    throw new ApiError("Invalid email or password.", 401);
  }

  const isValid = verifyPassword(payload.password, user.passwordHash);
  if (!isValid) {
    throw new ApiError("Invalid email or password.", 401);
  }

  return { id: String(user._id), fullName: user.fullName, email: user.email, role: "client" };
}

function trimToMax(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength);
}

function normalizeDomain(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function isNemnidhiDomain(domain: string) {
  return domain === "" || domain === "nemnidhi.com" || domain === "www.nemnidhi.com";
}

function inferGoalFromCategory(category: unknown) {
  if (category === "software_request") return "Build or improve software workflow";
  if (category === "infrastructure") return "Strengthen infrastructure and reliability";
  if (category === "legal_automation") return "Automate legal operations";
  if (category === "retainer_enterprise") return "Long-term growth and support partnership";
  return "Plan project execution with Nemnidhi team";
}

export async function createClientSignup(
  payload: z.infer<typeof clientSignupSchema>,
): Promise<ClientPortalIdentity> {
  const normalizedEmail = payload.email.toLowerCase().trim();

  const existingUser = await UserModel.findOne({ email: normalizedEmail }).lean();
  if (existingUser) {
    throw new ApiError("Account already exists with this email.", 409);
  }

  const latestWebsiteLead = await LeadModel.findOne({
    email: normalizedEmail,
    source: "website",
  })
    .sort({ updatedAt: -1 })
    .lean();

  const leadSourceDomain = normalizeDomain(latestWebsiteLead?.sourceDomain);
  const nemnidhiLead = isNemnidhiDomain(leadSourceDomain) ? latestWebsiteLead : null;

  const resolvedLegalName = trimToMax(payload.legalName, 200);
  const resolvedContactName = trimToMax(payload.fullName, 120);
  const resolvedPhone = trimToMax(payload.phone || String(nemnidhiLead?.phone || ""), 30);
  const resolvedGoal = trimToMax(
    payload.primaryGoal || inferGoalFromCategory(nemnidhiLead?.category),
    240,
  );
  const resolvedRequirementSummary = trimToMax(payload.requirementSummary, 500);
  const resolvedRequirementDetails = trimToMax(
    payload.requirementDetails || String(nemnidhiLead?.description || ""),
    3000,
  );

  const onboardingNotes = [
    nemnidhiLead ? "Lead linked from Nemnidhi website intake." : null,
    leadSourceDomain ? `Source domain: ${leadSourceDomain}` : null,
    nemnidhiLead?.sourcePath ? `Source path: ${nemnidhiLead.sourcePath}` : null,
    nemnidhiLead?.sourceReferrer ? `Source referrer: ${nemnidhiLead.sourceReferrer}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  let user: { _id: unknown; fullName: string; email: string } | null = null;
  try {
    const createdUser = await UserModel.create({
      fullName: resolvedContactName,
      email: normalizedEmail,
      role: "client",
      phone: resolvedPhone || undefined,
      passwordHash: hashPassword(payload.password),
      status: "active",
    });
    user = {
      _id: createdUser._id,
      fullName: createdUser.fullName,
      email: createdUser.email,
    };

    await ClientModel.findOneAndUpdate(
      { primaryContactEmail: normalizedEmail },
      {
        $set: {
          legalName: resolvedLegalName,
          primaryContactName: resolvedContactName,
          primaryContactEmail: normalizedEmail,
          primaryContactPhone: resolvedPhone || undefined,
          preferredCommunication: payload.preferredCommunication,
          requirementSummary: resolvedRequirementSummary,
          requirementDetails: resolvedRequirementDetails || undefined,
          onboardingStatus: "in_progress",
          leadId: nemnidhiLead?._id ?? undefined,
          onboardedAt: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await ClientOnboardingModel.findOneAndUpdate(
      { clientUserId: createdUser._id },
      {
        $set: {
          companyName: resolvedLegalName,
          primaryGoal: resolvedGoal,
          preferredCommunication: payload.preferredCommunication,
          billingContactEmail: normalizedEmail,
          projectBrief: trimToMax(
            resolvedRequirementDetails || resolvedRequirementSummary,
            2000,
          ),
          onboardingNotes: trimToMax(onboardingNotes, 1200),
          checklist: {
            accountSetup: true,
            businessProfile: true,
            requirementsShared: true,
            documentsShared: false,
            kickoffCallBooked: false,
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (syncError) {
    if (user?._id) {
      await Promise.allSettled([
        ClientOnboardingModel.deleteOne({ clientUserId: user._id }),
        UserModel.findByIdAndDelete(user._id),
      ]);
    }
    throw syncError;
  }

  if (!user) {
    throw new Error("Client account could not be created.");
  }

  return { id: String(user._id), fullName: user.fullName, email: user.email, role: "client" };
}

export async function activateClientInvite(
  payload: z.infer<typeof activateClientInviteSchema>,
): Promise<ClientPortalIdentity> {
  const tokenPayload = verifyInviteToken(payload.token);
  if (!tokenPayload) {
    throw new ApiError("This invite link is invalid or has expired.", 400);
  }

  const invite = await ClientInviteModel.findById(tokenPayload.inviteId);
  if (!invite || invite.status !== "pending") {
    throw new ApiError("This invite is no longer valid - ask a team member to resend it.", 400);
  }
  if (invite.tokenHash !== hashInviteToken(payload.token) || invite.email !== tokenPayload.email) {
    throw new ApiError("This invite link is invalid.", 400);
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    invite.status = "expired";
    await invite.save();
    throw new ApiError("This invite has expired - ask a team member to resend it.", 400);
  }

  const lead = await LeadModel.findById(invite.leadId).lean<Lead | null>();
  if (!lead) {
    throw new ApiError("The lead this invite was for no longer exists.", 404);
  }

  let user = await UserModel.findOne({ email: invite.email });
  if (user && user.role !== "client") {
    throw new ApiError("This email belongs to a staff account, not a client.", 409);
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

  return { id: String(user._id), fullName: user.fullName, email: user.email, role: "client" };
}

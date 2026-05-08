import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ClientModel, ClientOnboardingModel, LeadModel, UserModel } from "@/models";
import { clientSignupSchema } from "@/lib/validation/client-auth";
import { hashPassword } from "@/lib/auth/password";
import { buildSessionCookieValue } from "@/lib/auth/session";
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { fail, handleApiError } from "@/lib/api/responses";

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

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const payload = clientSignupSchema.parse(await request.json());
    const normalizedEmail = payload.email.toLowerCase().trim();

    const existingUser = await UserModel.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      return fail("Account already exists with this email.", 409);
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

    const role = "client" as const;
    const sessionValue = buildSessionCookieValue({
      userId: String(user._id),
      email: user.email,
      role,
      fullName: user.fullName,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: String(user._id),
          fullName: user.fullName,
          email: user.email,
          role,
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

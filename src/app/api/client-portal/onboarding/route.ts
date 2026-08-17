// Shared-secret counterpart to /api/client/onboarding.

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret, resolveClientPortalActor } from "@/lib/auth/client-portal-actor";
import { clientOnboardingSchema } from "@/lib/validation/client-onboarding";
import { ClientOnboardingModel } from "@/models";
import { handleApiError, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";

function parseKickoffDate(value?: string | null) {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid kickoff date.");
  }

  return parsed;
}

export async function GET(request: Request) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();

    const clientUserId = new URL(request.url).searchParams.get("clientUserId");
    if (!clientUserId) throw new Error("Unauthorized: missing clientUserId");
    const actor = await resolveClientPortalActor(clientUserId);

    const onboarding = await ClientOnboardingModel.findOne({ clientUserId: actor.userId }).lean();
    return ok(serializeForJson(onboarding));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();

    const { clientUserId, ...rest } = await request.json();
    if (!clientUserId) throw new Error("Unauthorized: missing clientUserId");
    const actor = await resolveClientPortalActor(clientUserId);

    const payload = clientOnboardingSchema.parse(rest);
    const kickoffDate = parseKickoffDate(payload.kickoffDate ?? null);

    const onboarding = await ClientOnboardingModel.findOneAndUpdate(
      { clientUserId: actor.userId },
      {
        $set: {
          companyName: payload.companyName,
          primaryGoal: payload.primaryGoal,
          kickoffDate,
          preferredCommunication: payload.preferredCommunication,
          billingContactEmail: payload.billingContactEmail,
          projectBrief: payload.projectBrief,
          onboardingNotes: payload.onboardingNotes,
          checklist: payload.checklist,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    return ok(serializeForJson(onboarding));
  } catch (error) {
    return handleApiError(error);
  }
}

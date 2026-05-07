import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { clientOnboardingSchema } from "@/lib/validation/client-onboarding";
import { ClientOnboardingModel } from "@/models";
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

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    if (actor.role !== "client") {
      throw new Error("Forbidden for role");
    }

    const onboarding = await ClientOnboardingModel.findOne({ clientUserId: actor.userId }).lean();
    return ok(serializeForJson(onboarding));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    if (actor.role !== "client") {
      throw new Error("Forbidden for role");
    }

    const payload = clientOnboardingSchema.parse(await request.json());
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

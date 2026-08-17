// Shared-secret counterpart to /api/public/questionnaire/submit - runs the identical
// recommendation pipeline, but for an already-authenticated portal client instead of an
// anonymous visitor. Only for the "no lead linked yet" case: re-submission/versioning is
// out of scope here, guarded by the already-linked check below.

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret, resolveClientPortalActor } from "@/lib/auth/client-portal-actor";
import { submitClientPortalQuestionnaireSchema } from "@/lib/validation/client-portal-questionnaire";
import { ClientModel, LeadModel, BlueprintModel, UserModel } from "@/models";
import { scoreLead } from "@/lib/leads/scoring";
import { serializeForJson } from "@/lib/utils/serialize";
import {
  answerToStorage,
  buildSelfServiceQuestionnaire,
  componentsFromAnswers,
  scaleTierFromAnswers,
  type Answer,
} from "@/lib/blueprint/questionnaire";
import { recommendComponents, summariseEstimate } from "@/lib/blueprint/recommend";
import { getDbPricingCatalog } from "@/lib/pricing/catalog-source";
import { resolveToRealCatalogCodes } from "@/lib/blueprint/legacy-trigger-map";
import { getIndustryProfile } from "@/lib/prospecting/industry-knowledge";
import { logActivity } from "@/lib/activity/logging";
import { ApiError, handleApiError, ok } from "@/lib/api/responses";

function buildDescription(storedAnswers: Array<{ question: string; answer: string }>) {
  const lines = storedAnswers.filter((a) => a.answer).map((a) => `${a.question} ${a.answer}`);
  const joined = lines.join(" ");
  return joined.length >= 10
    ? joined.slice(0, 5000)
    : "Client completed the business audit questionnaire from their portal account.";
}

export async function POST(request: Request) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();

    const payload = submitClientPortalQuestionnaireSchema.parse(await request.json());
    const actor = await resolveClientPortalActor(payload.clientUserId);

    const client = await ClientModel.findOne({ primaryContactEmail: actor.email });
    if (!client) {
      throw new ApiError("No client record found for this account.", 404);
    }
    if (client.leadId) {
      throw new ApiError("A project is already linked to your account.", 409);
    }

    const user = await UserModel.findById(actor.userId).lean();
    if (!user) {
      throw new ApiError("Account not found.", 404);
    }

    const questions = buildSelfServiceQuestionnaire(payload.industry, { segment: payload.segment });
    const answers: Answer[] = payload.answers.map((a) => ({
      questionCode: a.questionCode,
      values: a.values,
      note: a.note,
    }));

    const storedAnswers = answers
      .map((a) => answerToStorage(a, questions))
      .filter((a): a is NonNullable<typeof a> => a !== null);

    const scaleTier = scaleTierFromAnswers(answers);
    const { requestedCodes, declinedCodes, rationales } = componentsFromAnswers(answers, questions);

    const catalog = await getDbPricingCatalog();

    const realRequestedCodes = resolveToRealCatalogCodes(requestedCodes, catalog, payload.industry);
    const realDeclinedCodes = resolveToRealCatalogCodes(declinedCodes, catalog, payload.industry);
    const realRationales: Record<string, string> = {};
    for (const [legacyCode, rationale] of Object.entries(rationales)) {
      for (const realCode of resolveToRealCatalogCodes([legacyCode], catalog, payload.industry)) {
        realRationales[realCode] = rationale;
      }
    }

    const recommended = recommendComponents(catalog, {
      industry: payload.industry,
      segment: payload.segment,
      scaleTier,
      missingGapTags: [],
      requestedCodes: realRequestedCodes,
      declinedCodes: realDeclinedCodes,
      answerRationales: realRationales,
    });
    const estimate = summariseEstimate(recommended, "indicative");

    const industryLabel = getIndustryProfile(payload.industry, { segment: payload.segment })?.label ?? payload.industry;

    const lead = await LeadModel.create({
      title: `${user.fullName} - ${industryLabel} self-service audit`,
      contactName: user.fullName,
      email: user.email,
      phone: user.phone,
      source: "website",
      category: "software_request",
      urgency: "medium",
      description: buildDescription(storedAnswers),
      tags: [
        "self_service_questionnaire",
        "portal_authenticated",
        `industry:${payload.industry}`,
        ...(payload.segment ? [`segment:${payload.segment}`] : []),
      ],
      prospecting: { industry: payload.industry, segment: payload.segment, industryConfidence: "explicit" },
      ...scoreLead({ source: "website", category: "software_request", urgency: "medium" }),
    });

    const storedComponents = recommended.map((c) => ({
      code: c.code,
      title: c.title,
      rationale: c.rationale,
      origin: c.origin,
      included: true,
      features: c.features,
      oneTimePrice: c.oneTimePrice,
      monthlyPrice: c.monthlyPrice,
      deliveryWeeksMin: c.deliveryWeeksMin,
      deliveryWeeksMax: c.deliveryWeeksMax,
    }));

    const blueprint = await BlueprintModel.create({
      leadId: lead._id,
      version: 1,
      status: "draft",
      origin: "self_service",
      industry: payload.industry,
      segment: payload.segment,
      scaleTier,
      answers: storedAnswers,
      components: storedComponents,
      estimate,
      assumptions: [
        "Generated automatically from your questionnaire answers - a specialist will confirm this within one business day.",
      ],
      exclusions: [],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      preparedBy: null,
    });

    await ClientModel.findOneAndUpdate({ primaryContactEmail: actor.email }, { $set: { leadId: lead._id } });

    await logActivity({
      action: "blueprint_self_served",
      actorId: actor.userId,
      entityType: "blueprint",
      entityId: String(blueprint._id),
      details: { leadId: String(lead._id), industry: payload.industry, segment: payload.segment },
    });

    return ok(
      {
        leadId: String(lead._id),
        blueprint: serializeForJson(blueprint.toObject()),
      },
      { status: 201 },
    );
  } catch (error) {
    // Not yet reproduced locally despite sweeping every real industry/segment, heavy
    // multi-select overlap, and sparse/skipped answers - log the full stack server-side so a
    // real production occurrence is diagnosable, since handleApiError only returns a message.
    console.error("client-portal/questionnaire/submit failed:", error);
    return handleApiError(error);
  }
}

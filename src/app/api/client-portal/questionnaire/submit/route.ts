// Package-based counterpart to /api/public/questionnaire/submit for an already-authenticated
// portal client. Diverges deliberately from the public route's keyword/gap matcher
// (recommendComponents + legacy-trigger-map): resolves the client's industry/segment/tier
// straight to a PricingPackage instead, since the real catalog is packaged that way, not
// scale-tiered per component (see src/lib/pricing/package-lookup.ts). Only for the "no lead
// linked yet" case: re-submission/versioning is out of scope here, guarded by the
// already-linked check below. Follow-up call: /api/client-portal/questionnaire/finalize.

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret, resolveClientPortalActor } from "@/lib/auth/client-portal-actor";
import { submitClientPortalQuestionnaireSchema } from "@/lib/validation/client-portal-questionnaire";
import { ClientModel, LeadModel, BlueprintModel, UserModel } from "@/models";
import { scoreLead } from "@/lib/leads/scoring";
import { serializeForJson } from "@/lib/utils/serialize";
import { answerToStorage, buildSelfServiceQuestionnaire, type Answer } from "@/lib/blueprint/questionnaire";
import { CONFIDENCE_SPREAD, round } from "@/lib/blueprint/recommend";
import { resolvePricingPackage } from "@/lib/pricing/package-lookup";
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

    const resolved = await resolvePricingPackage(payload.industry, payload.segment, payload.tier);
    if (!resolved) {
      throw new ApiError(
        "We haven't set up pricing for this combination yet - a specialist will reach out to put together a custom estimate.",
        404,
      );
    }

    // Priced as the sum of the baseline (included) components' own prices - not the
    // package's sheet-listed setupPrice/monthlyPrice - so the number the client sees here
    // never jumps unexpectedly when they confirm without changing anything: finalize
    // computes the exact same way, just over whatever ends up selected.
    const spread = CONFIDENCE_SPREAD.indicative;
    const baselineOneTime = resolved.included.reduce((sum, c) => sum + c.oneTimePrice, 0);
    const baselineMonthly = resolved.included.reduce((sum, c) => sum + c.monthlyPrice, 0);
    const baselineWeeksMin = resolved.included.reduce((max, c) => Math.max(max, c.deliveryWeeksMin), 0);
    const baselineWeeksMax = resolved.included.reduce((sum, c) => sum + c.deliveryWeeksMax, 0);
    const estimate = {
      oneTimeMin: round(baselineOneTime * (1 - spread)),
      oneTimeMax: round(baselineOneTime * (1 + spread)),
      monthlyMin: round(baselineMonthly * (1 - spread)),
      monthlyMax: round(baselineMonthly * (1 + spread)),
      currency: "INR" as const,
      confidence: "indicative" as const,
      deliveryWeeksMin: baselineWeeksMin,
      deliveryWeeksMax: baselineWeeksMax,
    };

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

    const storedComponents = [
      ...resolved.included.map((c) => ({
        code: c.code,
        title: c.title,
        rationale: `Included in the ${resolved.tierLabel} package for this industry.`,
        origin: "recommended" as const,
        included: true,
        packageStatus: "included" as const,
        pillar: c.pillar,
        features: c.features,
        oneTimePrice: c.oneTimePrice,
        monthlyPrice: c.monthlyPrice,
        deliveryWeeksMin: c.deliveryWeeksMin,
        deliveryWeeksMax: c.deliveryWeeksMax,
      })),
      ...resolved.addons.map((c) => ({
        code: c.code,
        title: c.title,
        rationale: `Optional add-on available on the ${resolved.tierLabel} package.`,
        origin: "recommended" as const,
        included: false,
        packageStatus: "addon" as const,
        pillar: c.pillar,
        features: c.features,
        oneTimePrice: c.oneTimePrice,
        monthlyPrice: c.monthlyPrice,
        deliveryWeeksMin: c.deliveryWeeksMin,
        deliveryWeeksMax: c.deliveryWeeksMax,
      })),
    ];

    const blueprint = await BlueprintModel.create({
      leadId: lead._id,
      version: 1,
      status: "draft",
      origin: "self_service",
      industry: payload.industry,
      segment: payload.segment,
      packageId: resolved.packageId,
      pricingTierKey: resolved.tierKey,
      packageBaselinePrice: { oneTime: resolved.setupPrice, monthly: resolved.monthlyPrice },
      answers: storedAnswers,
      components: storedComponents,
      estimate,
      assumptions: [
        "Everything below is editable - uncheck anything you don't need and add any optional upgrades before confirming, then a specialist will follow up within one business day.",
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
    // handleApiError only returns a message to the client - log the full stack server-side too,
    // the diagnostic discipline that caught three real production bugs in the previous version
    // of this route (missing features/appliesToIndustries/scaleTiers/monthlyPrice on legacy-
    // seeded PricingComponent documents).
    console.error("client-portal/questionnaire/submit failed:", error);
    return handleApiError(error);
  }
}

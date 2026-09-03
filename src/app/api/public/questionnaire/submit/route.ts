import { connectToDatabase } from "@/lib/db/mongodb";
import { handleApiError, fail, ok } from "@/lib/api/responses";
import { LeadModel, BlueprintModel } from "@/models";
import { submitPublicQuestionnaireSchema } from "@/lib/validation/public-questionnaire";
import { scoreLead } from "@/lib/leads/scoring";
import { serializeForJson } from "@/lib/utils/serialize";
import {
  extractLeadSourceTracking,
  isAllowedLeadCaptureOrigin,
} from "@/lib/leads/source-tracking";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
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
import { getIndustryProfile, getIndustryKnowledge } from "@/lib/prospecting/industry-knowledge";
import { getProductBrand } from "@/lib/pricing/product-branding";

function buildCorsHeaders(origin: string, request: Request): HeadersInit {
  const requestedHeaders = request.headers.get("access-control-request-headers");
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": requestedHeaders ?? "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

function withCors(response: Response, origin: string, request: Request) {
  const corsHeaders = buildCorsHeaders(origin, request) as Record<string, string>;
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

function assertAllowedOrigin(request: Request) {
  const { requestOrigin } = extractLeadSourceTracking(request);
  if (!requestOrigin || !isAllowedLeadCaptureOrigin(requestOrigin)) {
    throw new Error("Forbidden for this origin");
  }
  return requestOrigin;
}

/**
 * A readable summary built from what was actually answered - the same
 * discipline the staff-facing description builders on the website use
 * (build the text from facts collected, never invent detail).
 */
function buildDescription(
  answers: Answer[],
  storedAnswers: Array<{ question: string; answer: string }>,
) {
  const lines = storedAnswers
    .filter((a) => a.answer)
    .map((a) => `${a.question} ${a.answer}`);
  const joined = lines.join(" ");
  return joined.length >= 10
    ? joined.slice(0, 5000)
    : "Prospect completed the self-service business audit questionnaire on the website.";
}

export async function OPTIONS(request: Request) {
  try {
    const origin = assertAllowedOrigin(request);
    return withCors(new Response(null, { status: 204 }), origin, request);
  } catch {
    return fail("Forbidden for this origin", 403);
  }
}

export async function POST(request: Request) {
  let origin: string | null = null;

  try {
    origin = assertAllowedOrigin(request);
    await connectToDatabase();

    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`public_questionnaire_submit:${ip}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return withCors(fail("Too many submissions. Please try again later.", 429), origin, request);
    }

    const payload = submitPublicQuestionnaireSchema.parse(await request.json());
    const tracking = extractLeadSourceTracking(request);

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

    // The questionnaire's trigger/decline codes were written against the old
    // smb-catalog.ts vocabulary; the real catalog uses different, often
    // industry-specific codes. Resolve before recommending - see
    // legacy-trigger-map.ts for why this can't be a flat alias.
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
      // No digital-presence audit has run for a brand-new self-service
      // prospect, so gap-driven recommendations are unavailable here -
      // everything comes from what the questionnaire itself triggered.
      missingGapTags: [],
      requestedCodes: realRequestedCodes,
      declinedCodes: realDeclinedCodes,
      answerRationales: realRationales,
    });
    const estimate = summariseEstimate(recommended, "indicative");

    const industryLabel = getIndustryProfile(payload.industry, { segment: payload.segment })?.label ?? payload.industry;
    // The bare industry label ("IT & Technology Services"), not the
    // segment-qualified knowledge-bank one above ("IT & Technology Services
    // - Freelancer / Small Agency") - that longer form reads fine as an
    // internal lead title but is the wrong shape for client-facing copy
    // (the results-page summary sentence and the product-brand strip).
    const cleanIndustryLabel = getIndustryKnowledge(payload.industry)?.label ?? industryLabel;

    const lead = await LeadModel.create({
      title: `${payload.contactName} - ${industryLabel} self-service audit`,
      contactName: payload.contactName,
      email: payload.email,
      phone: payload.phone,
      source: "website",
      category: "software_request",
      urgency: "medium",
      description: buildDescription(answers, storedAnswers),
      tags: ["self_service_questionnaire", `industry:${payload.industry}`, ...(payload.segment ? [`segment:${payload.segment}`] : [])],
      sourceDomain: tracking.sourceDomain,
      sourcePath: tracking.sourcePath,
      sourceReferrer: tracking.sourceReferrer,
      prospecting: { industry: payload.industry, segment: payload.segment, industryConfidence: "explicit" },
      ...scoreLead({ source: "website", category: "software_request", urgency: "medium" }),
    });

    const storedComponents = recommended.map((c) => ({
      code: c.code,
      title: c.title,
      rationale: c.rationale,
      origin: c.origin,
      department: c.department,
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

    // The results page shows what's recommended and why, grouped by
    // department - never a price. The full blueprint (with real numbers)
    // stays in the DB for staff follow-up; only this redacted shape goes
    // back to the browser. See HANDOFF.md 2026-09-03 for why - showing a
    // price on this page was creating negative psychological impact for the
    // prospect, per direct client feedback.
    return withCors(
      ok(
        {
          leadId: String(lead._id),
          blueprint: serializeForJson({
            industry: payload.industry,
            industryLabel: cleanIndustryLabel,
            segment: payload.segment ?? null,
            productBrand: getProductBrand(payload.industry, cleanIndustryLabel),
            components: recommended.map((c) => ({
              code: c.code,
              title: c.title,
              rationale: c.rationale,
              department: c.department,
              deliveryWeeksMin: c.deliveryWeeksMin,
              deliveryWeeksMax: c.deliveryWeeksMax,
            })),
            deliveryWeeksMin: estimate.deliveryWeeksMin,
            deliveryWeeksMax: estimate.deliveryWeeksMax,
            assumptions: blueprint.assumptions,
          }),
        },
        { status: 201 },
      ),
      origin,
      request,
    );
  } catch (error) {
    const response = handleApiError(error);
    if (!origin) return response;
    return withCors(response, origin, request);
  }
}

// Blueprint = the discovery-call requirements capture that sits between the
// audit report and the ScopeManifest (see src/models/Blueprint.ts's own doc
// comment). GET is shared between staff (any lead) and a client (their own
// lead only); POST creates a new version and is staff-only - the
// questionnaire is filled in on a call, not self-served by the client.

import { connectToDatabase } from "@/lib/db/mongodb";
import { BlueprintModel, LeadModel } from "@/models";
import { getCurrentSession } from "@/lib/auth/session";
import { assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { resolveClientLeadId } from "@/lib/auth/client-lead";
import { createBlueprintSchema } from "@/lib/validation/blueprint";
import { handleApiError, fail, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";
import { answerToStorage, buildQuestionnaire, componentsFromAnswers, scaleTierFromAnswers, type Answer } from "@/lib/blueprint/questionnaire";
import { gapsFromSignals } from "@/lib/blueprint/gaps";
import { recommendComponents, summariseEstimate } from "@/lib/blueprint/recommend";
import { smbCatalog } from "@/lib/pricing/smb-catalog";
import { toEnrichmentSignals } from "@/lib/prospecting/lead-adapter";
import type { Lead } from "@/types/lead";

type Params = Promise<{ leadId: string }>;

async function assertCanViewBlueprint(leadId: string) {
  const session = await getCurrentSession();
  if (!session) throw new Error("Unauthorized");

  if (session.role === "client") {
    const clientLeadId = await resolveClientLeadId(session);
    if (!clientLeadId || clientLeadId !== leadId) {
      throw new Error("Forbidden");
    }
    return session;
  }

  assertRoleAccess(session.role, { oneOf: permissionRules.manageLeads });
  return session;
}

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const { leadId } = await params;
    await assertCanViewBlueprint(leadId);

    const blueprint = await BlueprintModel.findOne({ leadId, status: { $ne: "superseded" } })
      .sort({ version: -1 })
      .lean();

    return ok(serializeForJson(blueprint));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const session = await getCurrentSession();
    if (!session) throw new Error("Unauthorized");
    assertRoleAccess(session.role, { oneOf: permissionRules.manageLeads });

    const { leadId } = await params;
    const payload = createBlueprintSchema.parse(await request.json());

    const lead = await LeadModel.findById(leadId).lean<Lead | null>();
    if (!lead) {
      return fail("Lead not found", 404);
    }

    const industry = lead.prospecting?.industry ?? null;
    const segment = lead.prospecting?.segment ?? null;

    const questions = buildQuestionnaire(industry, { segment });
    const answers: Answer[] = payload.answers.map((a) => ({
      questionCode: a.questionCode,
      values: a.values,
      note: a.note,
    }));

    const scaleTier = scaleTierFromAnswers(answers);
    const { requestedCodes, declinedCodes, rationales } = componentsFromAnswers(answers, questions);
    const missingGapTags = gapsFromSignals(toEnrichmentSignals(lead));

    const recommended = recommendComponents(smbCatalog, {
      industry,
      segment,
      scaleTier,
      missingGapTags,
      requestedCodes,
      declinedCodes,
      answerRationales: rationales,
    });
    const estimate = summariseEstimate(recommended, "indicative");

    const existing = await BlueprintModel.findOne({ leadId }).sort({ version: -1 });
    const nextVersion = (existing?.version ?? 0) + 1;
    if (existing && existing.status !== "superseded" && existing.status !== "expired") {
      existing.status = "superseded";
      await existing.save();
    }

    const storedAnswers = answers
      .map((a) => answerToStorage(a, questions))
      .filter((a): a is NonNullable<typeof a> => a !== null);

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
      leadId,
      version: nextVersion,
      status: "draft",
      industry,
      segment,
      scaleTier,
      answers: storedAnswers,
      components: storedComponents,
      estimate,
      assumptions: [],
      exclusions: [],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      preparedBy: session.userId,
    });

    return ok(serializeForJson(blueprint.toObject()));
  } catch (error) {
    return handleApiError(error);
  }
}

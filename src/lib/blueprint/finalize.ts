// Confirms a self-service client's addon selection on a package-based
// Blueprint and locks in the final estimate. Modeled directly on
// respondToBlueprint (src/lib/blueprint/respond.ts) - same ownership check,
// same "load latest, mutate, save, log" shape - but this is a distinct
// action: respond.ts is approve/reject on a *finished, staff-shared*
// document; this is the client configuring their *own draft* before it's
// ever seen by staff.

import { BlueprintModel } from "@/models";
import type { AuthSession } from "@/lib/auth/session";
import { resolveClientLeadId } from "@/lib/auth/client-lead";
import { CONFIDENCE_SPREAD, round } from "@/lib/blueprint/recommend";
import { ApiError } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";
import { logActivity } from "@/lib/activity/logging";

/**
 * The client can select or deselect ANY component (not just the addons) -
 * selectedComponentCodes is the full list of codes they want, replacing
 * whatever `included` was set to at submit time. Price is always the sum
 * of whichever components end up included, at "informed" confidence -
 * see submit route for why this replaced the earlier package-baseline
 * approach once components stopped being all-or-nothing.
 */
export async function finalizeSelfServiceBlueprint(actor: AuthSession, selectedComponentCodes: string[]) {
  const clientLeadId = await resolveClientLeadId(actor);
  if (!clientLeadId) throw new Error("Forbidden");

  const blueprint = await BlueprintModel.findOne({ leadId: clientLeadId }).sort({ version: -1 });
  if (!blueprint || blueprint.origin !== "self_service" || blueprint.status !== "draft") {
    throw new ApiError("No self-service blueprint is awaiting confirmation", 409);
  }

  const selected = new Set(selectedComponentCodes.map((c) => c.toUpperCase()));

  for (const component of blueprint.components) {
    component.included = selected.has(component.code);
  }

  type StoredComponent = (typeof blueprint.components)[number];
  const includedComponents = blueprint.components.filter((c: StoredComponent) => c.included);

  const oneTime = includedComponents.reduce((sum: number, c: StoredComponent) => sum + c.oneTimePrice, 0);
  const monthly = includedComponents.reduce((sum: number, c: StoredComponent) => sum + c.monthlyPrice, 0);
  const weeksMin = includedComponents.reduce((max: number, c: StoredComponent) => Math.max(max, c.deliveryWeeksMin), 0);
  const weeksMax = includedComponents.reduce((sum: number, c: StoredComponent) => sum + c.deliveryWeeksMax, 0);
  const spread = CONFIDENCE_SPREAD.informed;

  blueprint.estimate = {
    oneTimeMin: round(oneTime * (1 - spread)),
    oneTimeMax: round(oneTime * (1 + spread)),
    monthlyMin: round(monthly * (1 - spread)),
    monthlyMax: round(monthly * (1 + spread)),
    currency: "INR",
    confidence: "informed",
    deliveryWeeksMin: weeksMin,
    deliveryWeeksMax: weeksMax,
  };

  await blueprint.save();

  await logActivity({
    action: "blueprint_finalized",
    actorId: actor.userId,
    entityType: "blueprint",
    entityId: String(blueprint._id),
    details: { leadId: clientLeadId, selectedComponentCodes: [...selected] },
  });

  return serializeForJson(blueprint.toObject());
}

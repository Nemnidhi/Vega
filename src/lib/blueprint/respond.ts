// Shared by the cookie-session route (src/app/api/blueprint/[leadId]/respond/route.ts)
// and the shared-secret /api/client-portal/blueprint/[leadId]/respond route the website
// calls - identical logic, only the caller's identity source differs.

import { BlueprintModel } from "@/models";
import type { AuthSession } from "@/lib/auth/session";
import { resolveClientLeadId } from "@/lib/auth/client-lead";
import type { respondBlueprintSchema } from "@/lib/validation/blueprint";
import { logActivity } from "@/lib/activity/logging";
import { ApiError } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";
import type { z } from "zod";

export async function respondToBlueprint(
  session: AuthSession,
  leadId: string,
  payload: z.infer<typeof respondBlueprintSchema>,
  requestIp: string | null,
) {
  if (session.role !== "client") throw new Error("Forbidden");

  const clientLeadId = await resolveClientLeadId(session);
  if (!clientLeadId || clientLeadId !== leadId) throw new Error("Forbidden");

  if (payload.decision === "reject" && !payload.reason) {
    throw new ApiError("A reason is required when requesting changes", 422);
  }

  const blueprint = await BlueprintModel.findOne({ leadId }).sort({ version: -1 });
  if (!blueprint || blueprint.status !== "shared") {
    throw new ApiError("No shared blueprint is awaiting a response", 409);
  }

  if (payload.decision === "approve") {
    blueprint.status = "approved";
    blueprint.approvedAt = new Date();
    blueprint.approvedByName = session.fullName ?? session.email;
    blueprint.approvedFromIp = requestIp;
  } else {
    blueprint.status = "rejected";
    blueprint.rejectedAt = new Date();
    blueprint.rejectionReason = payload.reason ?? "";
  }
  await blueprint.save();

  await logActivity({
    action: payload.decision === "approve" ? "blueprint_approved" : "blueprint_rejected",
    actorId: session.userId,
    entityType: "blueprint",
    entityId: String(blueprint._id),
    details: { leadId, version: blueprint.version, decision: payload.decision },
  });

  return serializeForJson(blueprint.toObject());
}

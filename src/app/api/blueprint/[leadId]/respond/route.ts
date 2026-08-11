// Client-side response to a shared Blueprint - this is the "negotiation"
// loop: approve locks it in for scope-lock, reject-with-reason sends staff
// back to revise and re-share as a new version.

import { connectToDatabase } from "@/lib/db/mongodb";
import { BlueprintModel } from "@/models";
import { getCurrentSession } from "@/lib/auth/session";
import { resolveClientLeadId } from "@/lib/auth/client-lead";
import { respondBlueprintSchema } from "@/lib/validation/blueprint";
import { logActivity } from "@/lib/activity/logging";
import { handleApiError, fail, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ leadId: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const session = await getCurrentSession();
    if (!session) throw new Error("Unauthorized");
    if (session.role !== "client") throw new Error("Forbidden");

    const { leadId } = await params;
    const clientLeadId = await resolveClientLeadId(session);
    if (!clientLeadId || clientLeadId !== leadId) throw new Error("Forbidden");

    const payload = respondBlueprintSchema.parse(await request.json());
    if (payload.decision === "reject" && !payload.reason) {
      return fail("A reason is required when requesting changes", 422);
    }

    const blueprint = await BlueprintModel.findOne({ leadId }).sort({ version: -1 });
    if (!blueprint || blueprint.status !== "shared") {
      return fail("No shared blueprint is awaiting a response", 409);
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const requestIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() : null;

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

    return ok(serializeForJson(blueprint.toObject()));
  } catch (error) {
    return handleApiError(error);
  }
}

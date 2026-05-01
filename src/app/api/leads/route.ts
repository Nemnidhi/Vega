import { connectToDatabase } from "@/lib/db/mongodb";
import { LeadModel } from "@/models";
import { createLeadSchema } from "@/lib/validation/lead";
import { scoreLead } from "@/lib/leads/scoring";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";
import { logActivity } from "@/lib/activity/logging";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priorityBand = searchParams.get("priorityBand");
    const category = searchParams.get("category");

    const query: Record<string, string> = {};
    if (status) query.status = status;
    if (priorityBand) query.priorityBand = priorityBand;
    if (category) query.category = category;

    const leads = await LeadModel.find(query).sort({ updatedAt: -1 }).lean();
    return ok(serializeForJson(leads));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const payload = createLeadSchema.parse(await request.json());
    const scoring = scoreLead({
      source: payload.source,
      category: payload.category,
      urgency: payload.urgency,
      budget: payload.budget,
    });

    const lead = await LeadModel.create({
      ...payload,
      ...scoring,
      ownerId: actor.userId,
    });

    await logActivity({
      action: "lead_status_changed",
      actorId: actor.userId,
      entityType: "lead",
      entityId: String(lead._id),
      details: {
        from: null,
        to: lead.status,
        score: lead.score,
        priorityBand: lead.priorityBand,
      },
    });

    return ok(serializeForJson(lead), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

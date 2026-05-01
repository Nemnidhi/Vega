import { connectToDatabase } from "@/lib/db/mongodb";
import { LeadModel } from "@/models";
import { createLeadSchema } from "@/lib/validation/lead";
import { scoreLead } from "@/lib/leads/scoring";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

const updateLeadSchema = createLeadSchema.partial().omit({ status: true });

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const { id } = await params;
    const lead = await LeadModel.findById(id).lean();
    if (!lead) {
      throw new Error("Lead not found");
    }

    return ok(serializeForJson(lead));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const payload = updateLeadSchema.parse(await request.json());
    const { id } = await params;
    const existing = await LeadModel.findById(id);
    if (!existing) {
      throw new Error("Lead not found");
    }

    const merged = {
      source: payload.source ?? existing.source,
      category: payload.category ?? existing.category,
      urgency: payload.urgency ?? existing.urgency,
      budget: payload.budget ?? existing.budget,
    };
    const scoring = scoreLead(merged);

    Object.assign(existing, payload, scoring);
    await existing.save();

    return ok(serializeForJson(existing));
  } catch (error) {
    return handleApiError(error);
  }
}

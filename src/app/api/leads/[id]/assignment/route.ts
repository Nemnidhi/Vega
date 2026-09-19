import { assertSalesLeadAccess } from "@/lib/leads/access";
import { changeLeadOwner } from "@/lib/leads/transfer";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { ApiError, handleApiError, ok } from "@/lib/api/responses";
import { LeadModel, UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const assignmentSchema = z.object({ ownerId: objectId, expectedOwnerId: objectId.nullable() });
type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });
    const { id } = await params;
    await assertSalesLeadAccess(actor, id);
    objectId.parse(id);
    const lead = await LeadModel.findById(id).select("ownerId assignmentHistory").lean();
    if (!lead) throw new ApiError("Lead not found", 404);
    const currentOwnerId = lead.ownerId ? String(lead.ownerId) : null;
    await LeadModel.populate(lead, { path: "ownerId assignmentHistory.from assignmentHistory.to assignmentHistory.actorId", select: "fullName" });
    const salespeople = await UserModel.find({ role: "sales", status: "active" }).select("fullName").sort({ fullName: 1 }).lean();
    return ok(serializeForJson({ lead, salespeople, currentOwnerId }));
  } catch (error) { return handleApiError(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: ["admin", "sales"] });
    const { id } = await params;
    await assertSalesLeadAccess(actor, id);
    objectId.parse(id);
    const payload = assignmentSchema.parse(await request.json());
    const lead = await changeLeadOwner(id, payload, actor);
    return ok(serializeForJson(lead));
  } catch (error) { return handleApiError(error); }
}

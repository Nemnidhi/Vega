import { connectToDatabase } from "@/lib/db/mongodb";
import { LeadModel, LeadNoteModel } from "@/models";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";
import { z } from "zod";

type Params = Promise<{ id: string }>;

const createLeadNoteSchema = z.object({
  note: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const { id } = await params;
    const lead = await LeadModel.findById(id).select("_id").lean();
    if (!lead) {
      throw new Error("Lead not found");
    }

    const payload = createLeadNoteSchema.parse(await request.json());
    const note = await LeadNoteModel.create({
      leadId: id,
      note: payload.note,
      createdById: actor.userId,
    });

    await note.populate("createdById", "fullName email role");

    return ok(serializeForJson(note), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

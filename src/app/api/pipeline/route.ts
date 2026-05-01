import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { LeadModel } from "@/models";
import { handleApiError, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";

const stages = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const grouped = await Promise.all(
      stages.map(async (stage) => {
        const leads = await LeadModel.find({ status: stage })
          .sort({ updatedAt: -1 })
          .limit(40)
          .lean();

        return { stage, leads: serializeForJson(leads) };
      }),
    );

    return ok(grouped);
  } catch (error) {
    return handleApiError(error);
  }
}

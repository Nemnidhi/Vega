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
  "invalid",
] as const;

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const limitPerStage = 40;
    const [groupedByStage = {}] = await LeadModel.aggregate([
      {
        $facet: Object.fromEntries(
          stages.map((stage) => [
            stage,
            [
              { $match: { status: stage } },
              { $sort: { updatedAt: -1 } },
              { $limit: limitPerStage },
              {
                $project: {
                  title: 1,
                  contactName: 1,
                  email: 1,
                  phone: 1,
                  source: 1,
                  category: 1,
                  urgency: 1,
                  status: 1,
                  priorityBand: 1,
                  score: 1,
                  updatedAt: 1,
                },
              },
            ],
          ]),
        ),
      },
    ]);

    const grouped = stages.map((stage) => ({
      stage,
      leads: serializeForJson(groupedByStage[stage] ?? []),
    }));

    return ok(grouped);
  } catch (error) {
    return handleApiError(error);
  }
}

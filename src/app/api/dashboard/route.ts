import { leadVisibilityFilter, relatedLeadFilter } from "@/lib/leads/access";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { ActivityLogModel, LeadModel, ProposalModel, ScopeManifestModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { atLeast: "sales" });

    const [leadMetricRows, proposalMetricRows, scopeMetricRows, recentActivity] = await Promise.all([
      LeadModel.aggregate([
        { $match: leadVisibilityFilter(actor) },
        {
          $group: {
            _id: null,
            totalLeads: { $sum: 1 },
            heavyArtilleryLeads: {
              $sum: { $cond: [{ $eq: ["$priorityBand", "heavy_artillery"] }, 1, 0] },
            },
            closedWonLeads: {
              $sum: { $cond: [{ $eq: ["$status", "closed_won"] }, 1, 0] },
            },
          },
        },
      ]),
      ProposalModel.aggregate([
        { $match: await relatedLeadFilter(actor) },
        { $match: { status: "signed" } },
        { $count: "signedProposals" },
      ]),
      ScopeManifestModel.aggregate([
        { $match: await relatedLeadFilter(actor) },
        { $match: { isCompleted: true, signedAt: { $ne: null } } },
        { $count: "completedScopes" },
      ]),
      ActivityLogModel.find(actor.role === "sales" ? { actorId: actor.userId, entityType: { $nin: ["lead", "proposal", "blueprint", "scope_manifest"] } } : {})
        .sort({ createdAt: -1 })
        .limit(12)
        .select("action entityType createdAt")
        .lean(),
    ]);

    const leadMetrics = leadMetricRows[0] ?? {};
    const proposalMetrics = proposalMetricRows[0] ?? {};
    const scopeMetrics = scopeMetricRows[0] ?? {};

    return ok(
      serializeForJson({
        totalLeads: leadMetrics.totalLeads ?? 0,
        heavyArtilleryLeads: leadMetrics.heavyArtilleryLeads ?? 0,
        closedWonLeads: leadMetrics.closedWonLeads ?? 0,
        signedProposals: proposalMetrics.signedProposals ?? 0,
        completedScopes: scopeMetrics.completedScopes ?? 0,
        recentActivity,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

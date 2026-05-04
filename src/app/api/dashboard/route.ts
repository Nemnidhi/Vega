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

    const [
      totalLeads,
      heavyArtilleryLeads,
      closedWonLeads,
      signedProposals,
      completedScopes,
      recentActivity,
    ] = await Promise.all([
      LeadModel.countDocuments(),
      LeadModel.countDocuments({ priorityBand: "heavy_artillery" }),
      LeadModel.countDocuments({ status: "closed_won" }),
      ProposalModel.countDocuments({ status: "signed" }),
      ScopeManifestModel.countDocuments({ isCompleted: true, signedAt: { $ne: null } }),
      ActivityLogModel.find({})
        .sort({ createdAt: -1 })
        .limit(12)
        .select("action entityType createdAt")
        .lean(),
    ]);

    return ok(
      serializeForJson({
        totalLeads,
        heavyArtilleryLeads,
        closedWonLeads,
        signedProposals,
        completedScopes,
        recentActivity,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { ChangeOrderModel, ClientModel, ProposalModel, ScopeManifestModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.accessClientVault });

    const { id } = await params;
    const client = await ClientModel.findById(id).lean();
    if (!client) {
      throw new Error("Client not found");
    }

    const proposalQuery =
      actor.role === "client"
        ? { clientId: id, approvalStatus: "approved" }
        : { clientId: id };
    const scopeQuery =
      actor.role === "client"
        ? { clientId: id, isCompleted: true, signedAt: { $ne: null } }
        : { clientId: id };
    const changeOrderQuery =
      actor.role === "client"
        ? { clientId: id, approvalStatus: "approved" }
        : { clientId: id };

    const [proposals, scopeManifests, changeOrders] = await Promise.all([
      ProposalModel.find(proposalQuery).sort({ updatedAt: -1 }).lean(),
      ScopeManifestModel.find(scopeQuery).sort({ updatedAt: -1 }).lean(),
      ChangeOrderModel.find(changeOrderQuery).sort({ updatedAt: -1 }).lean(),
    ]);

    return ok(
      serializeForJson({
        client,
        proposals,
        scopeManifests,
        changeOrders,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

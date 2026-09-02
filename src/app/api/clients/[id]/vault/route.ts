import { connectToDatabase } from "@/lib/db/mongodb";
import { assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { getCurrentSession } from "@/lib/auth/session";
import { assertClientOwnsRecord } from "@/lib/auth/client-lead";
import { handleApiError, ok } from "@/lib/api/responses";
import { ChangeOrderModel, ClientModel, ProposalModel, ScopeManifestModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const session = await getCurrentSession();
    if (!session) throw new Error("Unauthorized");
    const actor = { userId: session.userId, role: session.role };
    assertRoleAccess(actor.role, { oneOf: permissionRules.accessClientVault });

    const { id } = await params;
    // The role gate above only proves "is a client", never "is *this* client" - without
    // this an authenticated client could read any other client's vault by id.
    await assertClientOwnsRecord(session, id);

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

import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { ClientModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { atLeast: "sales" });

    const { id } = await params;
    const client = await ClientModel.findById(id).lean();
    if (!client) {
      throw new Error("Client not found");
    }

    return ok(serializeForJson(client));
  } catch (error) {
    return handleApiError(error);
  }
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess } from "@/lib/auth/permissions";
import { assertEngineeringCanStart } from "@/lib/workflows/lead-guards";
import { handleApiError, ok } from "@/lib/api/responses";

type Params = Promise<{ id: string }>;

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: ["admin", "partner", "project_manager", "developer"] });

    const { id } = await params;
    await assertEngineeringCanStart(id);

    return ok({ allowed: true, message: "Engineering start allowed for this lead." });
  } catch (error) {
    return handleApiError(error);
  }
}

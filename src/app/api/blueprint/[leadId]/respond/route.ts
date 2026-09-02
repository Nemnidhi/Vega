// Client-side response to a shared Blueprint - this is the "negotiation"
// loop: approve locks it in for scope-lock, reject-with-reason sends staff
// back to revise and re-share as a new version.

import { connectToDatabase } from "@/lib/db/mongodb";
import { getCurrentSession } from "@/lib/auth/session";
import { respondBlueprintSchema } from "@/lib/validation/blueprint";
import { respondToBlueprint } from "@/lib/blueprint/respond";
import { handleApiError, ok } from "@/lib/api/responses";

type Params = Promise<{ leadId: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const session = await getCurrentSession();
    if (!session) throw new Error("Unauthorized");

    const { leadId } = await params;
    const payload = respondBlueprintSchema.parse(await request.json());

    const forwardedFor = request.headers.get("x-forwarded-for");
    const requestIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() ?? null : null;

    const blueprint = await respondToBlueprint(session, leadId, payload, requestIp);
    return ok(blueprint);
  } catch (error) {
    return handleApiError(error);
  }
}

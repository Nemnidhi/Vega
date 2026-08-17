// Shared-secret counterpart to /api/auth/client/activate - see auth/login/route.ts for
// the identity-vs-cookie distinction.

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret } from "@/lib/auth/client-portal-actor";
import { activateClientInviteSchema } from "@/lib/validation/client-auth";
import { activateClientInvite } from "@/lib/auth/client-portal-credentials";
import { handleApiError, ok } from "@/lib/api/responses";

export async function POST(request: Request) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();
    const payload = activateClientInviteSchema.parse(await request.json());
    const identity = await activateClientInvite(payload);
    return ok({ client: identity });
  } catch (error) {
    return handleApiError(error);
  }
}

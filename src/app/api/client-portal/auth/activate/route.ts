// Shared-secret counterpart to /api/auth/client/activate - see auth/login/route.ts for
// the identity-vs-cookie distinction.

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret } from "@/lib/auth/client-portal-actor";
import { activateClientInviteSchema } from "@/lib/validation/client-auth";
import { activateClientInvite } from "@/lib/auth/client-portal-credentials";
import { handleApiError, ok } from "@/lib/api/responses";
import { assertAuthRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();
    const payload = activateClientInviteSchema.parse(await request.json());
    await assertAuthRateLimit(request, "portal_activate", payload.token, { ipLimit: Number.MAX_SAFE_INTEGER });
    const identity = await activateClientInvite(payload);
    return ok({ client: identity });
  } catch (error) {
    return handleApiError(error);
  }
}

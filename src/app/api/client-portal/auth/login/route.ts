// Shared-secret counterpart to /api/auth/client/login - called server-to-server by
// nemnidhi.com's own backend, never directly by a browser. Returns the client identity
// as JSON instead of setting Vega's own session cookie; the website wraps this in its
// own session.

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret } from "@/lib/auth/client-portal-actor";
import { clientLoginSchema } from "@/lib/validation/client-auth";
import { verifyClientCredentials } from "@/lib/auth/client-portal-credentials";
import { handleApiError, ok } from "@/lib/api/responses";
import { assertAuthRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();
    const payload = clientLoginSchema.parse(await request.json());
    // Every call arrives from the website backend's single address, so only the
    // per-identity bucket carries signal here.
    await assertAuthRateLimit(request, "portal_login", payload.email, { ipLimit: Number.MAX_SAFE_INTEGER });
    const identity = await verifyClientCredentials(payload);
    return ok({ client: identity });
  } catch (error) {
    return handleApiError(error);
  }
}

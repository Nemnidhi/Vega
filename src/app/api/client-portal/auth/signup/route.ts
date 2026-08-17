// Shared-secret counterpart to /api/auth/client/signup - see auth/login/route.ts for
// the identity-vs-cookie distinction.

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret } from "@/lib/auth/client-portal-actor";
import { clientSignupSchema } from "@/lib/validation/client-auth";
import { createClientSignup } from "@/lib/auth/client-portal-credentials";
import { handleApiError, ok } from "@/lib/api/responses";

export async function POST(request: Request) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();
    const payload = clientSignupSchema.parse(await request.json());
    const identity = await createClientSignup(payload);
    return ok({ client: identity });
  } catch (error) {
    return handleApiError(error);
  }
}

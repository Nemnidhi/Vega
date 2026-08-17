// Shared-secret counterpart to /api/client/queries - client-only (the existing route
// also serves staff for GET, but client-portal callers are always role "client" by
// construction, so that branch doesn't apply here).

import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidClientPortalSecret, resolveClientPortalActor } from "@/lib/auth/client-portal-actor";
import { createClientQuerySchema } from "@/lib/validation/client-query";
import { ClientQueryModel } from "@/models";
import { handleApiError, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET(request: Request) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();

    const clientUserId = new URL(request.url).searchParams.get("clientUserId");
    if (!clientUserId) throw new Error("Unauthorized: missing clientUserId");
    const actor = await resolveClientPortalActor(clientUserId);

    const queries = await ClientQueryModel.find({ raisedBy: actor.userId })
      .sort({ createdAt: -1 })
      .lean();
    return ok(serializeForJson(queries));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertValidClientPortalSecret(request);
    await connectToDatabase();

    const { clientUserId, ...rest } = await request.json();
    if (!clientUserId) throw new Error("Unauthorized: missing clientUserId");
    const actor = await resolveClientPortalActor(clientUserId);

    const payload = createClientQuerySchema.parse(rest);
    const query = await ClientQueryModel.create({
      raisedBy: actor.userId,
      projectName: payload.projectName,
      subject: payload.subject,
      message: payload.message,
      priority: payload.priority,
      status: "open",
    });

    return ok(serializeForJson(query), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

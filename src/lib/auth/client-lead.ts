import { ClientModel } from "@/models";
import type { AuthSession } from "@/lib/auth/session";

/**
 * A logged-in client's session carries no leadId directly - the link lives
 * on their Client record (matched by email), which may or may not have one
 * yet (older/converted clients don't). Every place that needs to scope data
 * to "this client's own lead" goes through here so the lookup stays in sync.
 */
export async function resolveClientLeadId(session: AuthSession): Promise<string | null> {
  if (session.role !== "client") return null;

  const client = await ClientModel.findOne({ primaryContactEmail: session.email })
    .select("leadId")
    .lean();

  if (!client?.leadId) return null;
  return String(client.leadId);
}

/**
 * The id of the Client record a logged-in client owns, matched the same way
 * resolveClientLeadId matches it. Any route that takes a clientId from the URL
 * and serves the `client` role has to check it against this - the role gate
 * alone says "is a client", never "is *this* client".
 */
export async function resolveClientId(session: AuthSession): Promise<string | null> {
  if (session.role !== "client") return null;

  const client = await ClientModel.findOne({ primaryContactEmail: session.email })
    .select("_id")
    .lean();

  if (!client?._id) return null;
  return String(client._id);
}

/**
 * Throws unless `clientId` is the caller's own Client record. Staff roles pass
 * through untouched - they are allowed to read across clients, and their access
 * is gated by the role check the caller already ran.
 */
export async function assertClientOwnsRecord(session: AuthSession, clientId: string) {
  if (session.role !== "client") return;

  const ownClientId = await resolveClientId(session);
  if (!ownClientId || ownClientId !== String(clientId)) {
    throw new Error("Forbidden");
  }
}

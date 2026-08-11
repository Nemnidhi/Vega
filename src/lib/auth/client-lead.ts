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

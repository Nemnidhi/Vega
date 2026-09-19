import { UserModel } from "@/models";
import { activeAdminIds, notifyUser, notifyUsers } from "@/lib/notifications/dispatch";

/**
 * Lead-pipeline notifications.
 *
 * Every one of these is best-effort: a lead must still be created, assigned or
 * rebalanced even if nobody can be told about it, so callers fire these without
 * awaiting the result and failures are logged rather than thrown.
 */

function leadUrl(leadId: string) {
  return `/leads/${leadId}`;
}

async function actorName(actorId?: string | null) {
  if (!actorId) return null;
  const user = await UserModel.findById(actorId).select("fullName email").lean();
  return user?.fullName || user?.email || null;
}

/**
 * A lead changed hands. Both sides are told: the new owner because it is now
 * their work, the previous owner because a lead disappearing from your list
 * without explanation is worse than a notification.
 */
export async function notifyLeadAssigned(input: {
  leadId: string;
  leadTitle: string;
  newOwnerId: string;
  previousOwnerId?: string | null;
  actorId: string;
  byAdmin: boolean;
}) {
  const who = await actorName(input.actorId);
  const type = input.byAdmin ? "lead_assigned" : "lead_transferred";
  // The lead can move repeatedly, and each move is genuinely new - so the
  // dedupe key includes both ends of this particular hand-off.
  const suffix = `${input.previousOwnerId ?? "none"}:${input.newOwnerId}`;

  await notifyUser({
    recipientUserId: input.newOwnerId,
    actorId: input.actorId,
    type,
    title: input.byAdmin ? "Lead assigned to you" : "Lead transferred to you",
    body: who ? `${input.leadTitle} - from ${who}` : input.leadTitle,
    entityType: "lead",
    entityId: input.leadId,
    url: leadUrl(input.leadId),
    dedupeKey: `${type}:${input.leadId}:${suffix}`,
    metadata: { leadTitle: input.leadTitle },
  });

  if (input.previousOwnerId && input.previousOwnerId !== input.newOwnerId) {
    const newOwner = await actorName(input.newOwnerId);
    await notifyUser({
      recipientUserId: input.previousOwnerId,
      actorId: input.actorId,
      type: "lead_transferred",
      title: "Lead moved off your list",
      body: newOwner ? `${input.leadTitle} - now with ${newOwner}` : input.leadTitle,
      entityType: "lead",
      entityId: input.leadId,
      url: leadUrl(input.leadId),
      dedupeKey: `lead_moved_away:${input.leadId}:${suffix}`,
      metadata: { leadTitle: input.leadTitle },
    });
  }
}

/**
 * A new lead entered the system. The assigned salesperson is told because it is
 * theirs to work; admins are told because inbound volume is something they watch.
 *
 * Deliberately not called from the bulk importer - importing a spreadsheet of
 * 500 leads must not fire 500 notifications.
 */
export async function notifyLeadCreated(input: {
  leadId: string;
  leadTitle: string;
  ownerId?: string | null;
  actorId?: string | null;
  source?: string | null;
  /** Inbound leads (website, Meta) are the ones admins care about. */
  notifyAdmins?: boolean;
}) {
  const sourceLabel = input.source ? input.source.replaceAll("_", " ") : "";

  if (input.ownerId) {
    await notifyUser({
      recipientUserId: input.ownerId,
      actorId: input.actorId ?? null,
      type: "lead_created",
      title: "New lead assigned to you",
      body: sourceLabel ? `${input.leadTitle} - via ${sourceLabel}` : input.leadTitle,
      entityType: "lead",
      entityId: input.leadId,
      url: leadUrl(input.leadId),
      dedupeKey: `lead_created:${input.leadId}:${input.ownerId}`,
      metadata: { leadTitle: input.leadTitle, source: input.source ?? null },
    });
  }

  if (input.notifyAdmins) {
    const admins = await activeAdminIds();
    await notifyUsers(admins, {
      actorId: input.actorId ?? null,
      type: "lead_created",
      title: "New lead received",
      body: sourceLabel ? `${input.leadTitle} - via ${sourceLabel}` : input.leadTitle,
      entityType: "lead",
      entityId: input.leadId,
      url: leadUrl(input.leadId),
      dedupeKey: `lead_created_admin:${input.leadId}`,
      metadata: { leadTitle: input.leadTitle, source: input.source ?? null },
    });
  }
}

/**
 * A rebalance moves many leads at once, so each affected salesperson gets one
 * summary rather than a notification per lead.
 */
export async function notifyLeadsRebalanced(input: {
  /** Per new owner: how many leads moved, and one of them to link to. */
  movesByOwner: Map<string, { count: number; sampleLeadId: string }>;
  actorId: string;
  at: Date;
}) {
  await Promise.all(
    [...input.movesByOwner.entries()].map(([ownerId, { count, sampleLeadId }]) =>
      notifyUser({
        recipientUserId: ownerId,
        actorId: input.actorId,
        type: "lead_rebalanced",
        title: "Leads rebalanced",
        body: `${count} lead${count === 1 ? "" : "s"} moved to you`,
        entityType: "lead",
        // A summary has no single subject, so it points at one of the leads that
        // moved and opens the full list instead.
        entityId: sampleLeadId,
        url: "/leads",
        // One summary per rebalance run, not one per lead.
        dedupeKey: `lead_rebalanced:${ownerId}:${input.at.toISOString()}`,
        metadata: { count },
      }),
    ),
  );
}

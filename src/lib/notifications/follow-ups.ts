import { LeadFollowUpModel, LeadModel } from "@/models";
import { notifyUser } from "@/lib/notifications/dispatch";

/**
 * Overdue lead follow-ups.
 *
 * A follow-up is the commitment to call someone back on a date. Missing one
 * silently is how a lead goes cold, so the rep it belongs to is reminded every
 * day it stays open rather than once.
 */
export async function sweepOverdueFollowUps() {
  const now = new Date();

  const overdue = await LeadFollowUpModel.find({
    status: "scheduled",
    dueAt: { $lt: now },
    assignedToUserId: { $ne: null },
  })
    .select("leadId dueAt nextAction assignedToUserId priority")
    .lean();

  if (overdue.length === 0) return 0;

  // One lookup for the names rather than one per follow-up.
  const leads = await LeadModel.find({ _id: { $in: overdue.map((item) => item.leadId) } })
    .select("title")
    .lean();
  const leadTitles = new Map(leads.map((lead) => [String(lead._id), lead.title as string]));

  await Promise.all(
    overdue.map((followUp) => {
      const leadTitle = leadTitles.get(String(followUp.leadId)) ?? "Lead";
      const dueLabel = followUp.dueAt ? new Date(followUp.dueAt).toLocaleDateString() : "";

      return notifyUser({
        recipientUserId: String(followUp.assignedToUserId),
        actorId: null,
        type: "due_date_approaching",
        title: `Follow-up overdue: ${leadTitle}`,
        body: `${followUp.nextAction}${dueLabel ? ` - was due ${dueLabel}` : ""}`,
        entityType: "lead",
        entityId: String(followUp.leadId),
        url: `/leads/${followUp.leadId}`,
        // Keyed to the day so it nags once daily until the follow-up is closed,
        // instead of on every sweep run.
        dedupeKey: `followup_overdue:${followUp._id}:${now.toDateString()}`,
        metadata: { followUpId: String(followUp._id), dueAt: followUp.dueAt },
      });
    }),
  );

  return overdue.length;
}

/**
 * Hand a lead's open follow-ups to its new owner.
 *
 * Without this, a transfer or rebalance leaves follow-ups assigned to the
 * previous rep - who, being sales, can no longer even open the lead. They then
 * get an overdue reminder that 404s, and the new owner never learns the
 * follow-up exists.
 */
export async function reassignOpenFollowUps(leadId: string, newOwnerId: string) {
  const result = await LeadFollowUpModel.updateMany(
    { leadId, status: "scheduled", assignedToUserId: { $ne: newOwnerId } },
    { $set: { assignedToUserId: newOwnerId } },
  );
  return result.modifiedCount;
}

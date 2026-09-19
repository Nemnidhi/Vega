import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { NotificationModel, UserModel } from "@/models";
import { sendPushToUser } from "@/lib/push/send";

export type NotificationType =
  | "subtask_assigned"
  | "subtask_reassigned"
  | "subtask_ready"
  | "dependency_completed"
  | "subtask_blocked"
  | "due_date_approaching"
  | "subtask_overdue"
  | "comment_mention"
  | "approval_requested"
  | "approval_accepted"
  | "approval_rejected"
  | "workflow_changed"
  | "lead_assigned"
  | "lead_transferred"
  | "lead_created"
  | "lead_rebalanced";

export interface NotifyInput {
  recipientUserId?: string | null;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  entityType: "task" | "lead";
  entityId: string;
  /** Where tapping the notification should land. */
  url: string;
  subtaskId?: string | null;
  dependencyId?: string | null;
  dedupeKey: string;
  metadata?: Record<string, unknown>;
}

/**
 * The one place a notification is raised.
 *
 * Writes the in-app row and sends the push together, so the bell and the phone
 * can never disagree about what happened. Everything that notifies anybody goes
 * through here rather than touching NotificationModel or sendPushToUser directly.
 */
export async function notifyUser(input: NotifyInput) {
  if (!input.recipientUserId) return { created: false };

  // Nobody needs telling about something they just did themselves.
  if (input.actorId && String(input.actorId) === String(input.recipientUserId)) {
    return { created: false };
  }

  await connectToDatabase();

  const result = await NotificationModel.updateOne(
    { recipientUserId: input.recipientUserId, dedupeKey: input.dedupeKey },
    {
      $setOnInsert: {
        recipientUserId: new Types.ObjectId(input.recipientUserId),
        actorId: input.actorId ? new Types.ObjectId(input.actorId) : null,
        type: input.type,
        title: input.title,
        body: input.body ?? "",
        entityType: input.entityType,
        entityId: new Types.ObjectId(input.entityId),
        url: input.url,
        subtaskId: input.subtaskId ? new Types.ObjectId(input.subtaskId) : null,
        dependencyId: input.dependencyId ? new Types.ObjectId(input.dependencyId) : null,
        channels: ["in_app", "push"],
        metadata: input.metadata ?? {},
        dedupeKey: input.dedupeKey,
      },
    },
    { upsert: true },
  );

  // Push only when a row was genuinely inserted. The due-date sweep and any
  // retried request re-raise the same notification on purpose - deduped in the
  // bell, but without this check each re-run would buzz the phone again.
  const created = (result.upsertedCount ?? 0) > 0;
  if (created) {
    void sendPushToUser(input.recipientUserId, {
      title: input.title,
      body: input.body ?? "",
      url: input.url,
      // Collapse repeats about the same thing into one drawer row.
      tag: input.dedupeKey,
    }).catch((error) => console.error("notifyUser push failed:", error));
  }

  return { created };
}

/** Raise the same notification for several people, e.g. every admin. */
export async function notifyUsers(recipientUserIds: string[], input: Omit<NotifyInput, "recipientUserId">) {
  const unique = [...new Set(recipientUserIds.filter(Boolean))];
  await Promise.all(unique.map((recipientUserId) => notifyUser({ ...input, recipientUserId })));
}

/** Active admins - the people who want to know about inbound leads. */
export async function activeAdminIds() {
  const admins = await UserModel.find({ role: "admin", status: "active" }).select("_id").lean();
  return admins.map((admin) => String(admin._id));
}

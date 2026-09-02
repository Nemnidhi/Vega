import { Types } from "mongoose";
import { logActivity } from "@/lib/activity/logging";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ActivityLogModel, NotificationModel, TaskDependencyModel, TaskModel, UserModel } from "@/models";
import type { ActivityAction } from "@/types/activity-log";

type NotificationType =
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
  | "workflow_changed";

type TaskLike = {
  _id: unknown;
  code?: string;
  title: string;
  assignedToUserId?: unknown;
  parentTaskId?: unknown;
  workflowNodeType?: string;
  workflowDecision?: string;
  dueAt?: Date | string | null;
};

type WorkflowNotificationInput = {
  recipientUserId?: string | null;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  parentTaskId: string;
  subtaskId?: string | null;
  dependencyId?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
};

function id(value: unknown) {
  return String((value as { _id?: unknown })?._id ?? value ?? "");
}

function taskLabel(task: TaskLike) {
  return `${task.code ? `${task.code} ` : ""}${task.title}`;
}

function notificationDedupe(type: string, parentTaskId: string, subtaskId?: string | null, suffix = "") {
  return [type, parentTaskId, subtaskId, suffix].filter(Boolean).join(":");
}

export async function createWorkflowNotification(input: WorkflowNotificationInput) {
  if (!input.recipientUserId) return null;
  await connectToDatabase();

  return NotificationModel.updateOne(
    {
      recipientUserId: input.recipientUserId,
      dedupeKey: input.dedupeKey ?? notificationDedupe(input.type, input.parentTaskId, input.subtaskId),
    },
    {
      $setOnInsert: {
        recipientUserId: new Types.ObjectId(input.recipientUserId),
        actorId: input.actorId ? new Types.ObjectId(input.actorId) : null,
        type: input.type,
        title: input.title,
        body: input.body ?? "",
        entityType: "task",
        entityId: new Types.ObjectId(input.parentTaskId),
        subtaskId: input.subtaskId ? new Types.ObjectId(input.subtaskId) : null,
        dependencyId: input.dependencyId ? new Types.ObjectId(input.dependencyId) : null,
        channels: ["in_app"],
        metadata: input.metadata ?? {},
        dedupeKey: input.dedupeKey ?? notificationDedupe(input.type, input.parentTaskId, input.subtaskId),
      },
    },
    { upsert: true },
  );
}

export async function recordWorkflowActivity(input: {
  action: ActivityAction;
  actorId?: string | null;
  parentTaskId: string;
  details?: Record<string, unknown>;
}) {
  await logActivity({
    action: input.action,
    actorId: input.actorId,
    entityType: "task",
    entityId: input.parentTaskId,
    details: input.details,
  });
}

export async function notifySubtaskCreated(subtask: TaskLike, actorId: string, parentTaskId: string) {
  await recordWorkflowActivity({
    action: "subtask_created",
    actorId,
    parentTaskId,
    details: { subtaskId: id(subtask._id), message: `created ${taskLabel(subtask)}` },
  });
  await createWorkflowNotification({
    recipientUserId: id(subtask.assignedToUserId),
    actorId,
    type: "subtask_assigned",
    title: `Assigned: ${taskLabel(subtask)}`,
    body: "A new subtask has been assigned to you.",
    parentTaskId,
    subtaskId: id(subtask._id),
    dedupeKey: notificationDedupe("subtask_assigned", parentTaskId, id(subtask._id), "created"),
  });
  if (subtask.workflowNodeType === "APPROVAL") {
    await createWorkflowNotification({
      recipientUserId: id(subtask.assignedToUserId),
      actorId,
      type: "approval_requested",
      title: `Approval requested: ${taskLabel(subtask)}`,
      body: "An approval node is waiting for your review.",
      parentTaskId,
      subtaskId: id(subtask._id),
      dedupeKey: notificationDedupe("approval_requested", parentTaskId, id(subtask._id)),
    });
    await recordWorkflowActivity({
      action: "approval_requested",
      actorId,
      parentTaskId,
      details: { subtaskId: id(subtask._id), message: `requested approval for ${taskLabel(subtask)}` },
    });
  }
}

export async function notifyAssignmentChange(input: {
  subtask: TaskLike;
  parentTaskId: string;
  actorId: string;
  previousAssigneeId?: string;
  nextAssigneeId?: string;
}) {
  if (!input.nextAssigneeId || input.previousAssigneeId === input.nextAssigneeId) return;
  const reassigned = Boolean(input.previousAssigneeId);
  await recordWorkflowActivity({
    action: reassigned ? "subtask_reassigned" : "subtask_assigned",
    actorId: input.actorId,
    parentTaskId: input.parentTaskId,
    details: {
      subtaskId: id(input.subtask._id),
      previousAssigneeId: input.previousAssigneeId,
      nextAssigneeId: input.nextAssigneeId,
      message: `${reassigned ? "reassigned" : "assigned"} ${taskLabel(input.subtask)}`,
    },
  });
  await createWorkflowNotification({
    recipientUserId: input.nextAssigneeId,
    actorId: input.actorId,
    type: reassigned ? "subtask_reassigned" : "subtask_assigned",
    title: `${reassigned ? "Reassigned" : "Assigned"}: ${taskLabel(input.subtask)}`,
    body: reassigned ? "This subtask has been reassigned to you." : "This subtask has been assigned to you.",
    parentTaskId: input.parentTaskId,
    subtaskId: id(input.subtask._id),
    dedupeKey: notificationDedupe(reassigned ? "subtask_reassigned" : "subtask_assigned", input.parentTaskId, id(input.subtask._id), input.nextAssigneeId),
  });
}

export async function notifySubtaskStateChange(input: {
  subtask: TaskLike;
  parentTaskId: string;
  actorId?: string | null;
  previousStatus?: string;
  nextStatus: string;
}) {
  const subtaskId = id(input.subtask._id);
  if (input.nextStatus === "COMPLETED") {
    await recordWorkflowActivity({
      action: "subtask_completed",
      actorId: input.actorId,
      parentTaskId: input.parentTaskId,
      details: { subtaskId, from: input.previousStatus, to: input.nextStatus, message: `completed ${taskLabel(input.subtask)}` },
    });
  }

  if (input.nextStatus === "READY") {
    await recordWorkflowActivity({
      action: "subtask_ready",
      actorId: input.actorId,
      parentTaskId: input.parentTaskId,
      details: { subtaskId, message: `${taskLabel(input.subtask)} automatically became Ready` },
    });
    await createWorkflowNotification({
      recipientUserId: id(input.subtask.assignedToUserId),
      actorId: input.actorId,
      type: "subtask_ready",
      title: `Ready: ${taskLabel(input.subtask)}`,
      body: "All active dependencies are satisfied.",
      parentTaskId: input.parentTaskId,
      subtaskId,
      dedupeKey: notificationDedupe("subtask_ready", input.parentTaskId, subtaskId, input.nextStatus),
    });
  }

  if (input.nextStatus === "BLOCKED") {
    await recordWorkflowActivity({
      action: "subtask_blocked",
      actorId: input.actorId,
      parentTaskId: input.parentTaskId,
      details: { subtaskId, from: input.previousStatus, to: input.nextStatus, message: `${taskLabel(input.subtask)} was blocked` },
    });
    await createWorkflowNotification({
      recipientUserId: id(input.subtask.assignedToUserId),
      actorId: input.actorId,
      type: "subtask_blocked",
      title: `Blocked: ${taskLabel(input.subtask)}`,
      body: "This subtask is blocked by an unfinished dependency.",
      parentTaskId: input.parentTaskId,
      subtaskId,
      dedupeKey: notificationDedupe("subtask_blocked", input.parentTaskId, subtaskId, input.nextStatus),
    });
  }
}

export async function notifyApprovalRequested(subtask: TaskLike, actorId: string, parentTaskId: string) {
  if (subtask.workflowNodeType !== "APPROVAL") return;
  await recordWorkflowActivity({
    action: "approval_requested",
    actorId,
    parentTaskId,
    details: { subtaskId: id(subtask._id), message: `requested approval for ${taskLabel(subtask)}` },
  });
  await createWorkflowNotification({
    recipientUserId: id(subtask.assignedToUserId),
    actorId,
    type: "approval_requested",
    title: `Approval requested: ${taskLabel(subtask)}`,
    body: "An approval node is waiting for your review.",
    parentTaskId,
    subtaskId: id(subtask._id),
    dedupeKey: notificationDedupe("approval_requested", parentTaskId, id(subtask._id), String(subtask.workflowDecision ?? "")),
  });
}

export async function notifyDependencyCompleted(predecessor: TaskLike, actorId: string, parentTaskId: string) {
  const dependencies = await TaskDependencyModel.find({ parentTaskId, predecessorSubtaskId: predecessor._id })
    .populate("successorSubtaskId", "code title assignedToUserId")
    .lean();
  await Promise.all(
    dependencies.map((dependency) => {
      const successor = dependency.successorSubtaskId as unknown as TaskLike;
      return createWorkflowNotification({
        recipientUserId: id(successor.assignedToUserId),
        actorId,
        type: "dependency_completed",
        title: `Dependency completed: ${taskLabel(predecessor)}`,
        body: `${taskLabel(successor)} may now be closer to ready.`,
        parentTaskId,
        subtaskId: id(successor._id),
        dependencyId: id(dependency._id),
        dedupeKey: notificationDedupe("dependency_completed", parentTaskId, id(successor._id), id(predecessor._id)),
      });
    }),
  );
}

export async function notifyApprovalDecision(input: {
  subtask: TaskLike;
  parentTaskId: string;
  actorId: string;
  decision: string;
}) {
  const normalized = input.decision.toUpperCase();
  if (!["APPROVED", "REJECTED"].includes(normalized)) return;
  const action = normalized === "APPROVED" ? "approval_accepted" : "approval_rejected";
  await recordWorkflowActivity({
    action,
    actorId: input.actorId,
    parentTaskId: input.parentTaskId,
    details: { subtaskId: id(input.subtask._id), decision: normalized, message: `${taskLabel(input.subtask)} was ${normalized.toLowerCase()}` },
  });
  await createWorkflowNotification({
    recipientUserId: id(input.subtask.assignedToUserId),
    actorId: input.actorId,
    type: action,
    title: `${normalized === "APPROVED" ? "Approved" : "Rejected"}: ${taskLabel(input.subtask)}`,
    body: `Approval result: ${normalized}.`,
    parentTaskId: input.parentTaskId,
    subtaskId: id(input.subtask._id),
    dedupeKey: notificationDedupe(action, input.parentTaskId, id(input.subtask._id), normalized),
  });
}

export async function notifyWorkflowChanged(input: {
  parentTaskId: string;
  actorId: string;
  title: string;
  body?: string;
  subtaskId?: string;
  dependencyId?: string;
}) {
  const parent = await TaskModel.findById(input.parentTaskId).select("assignedToUserId createdBy").lean();
  const recipients = [...new Set([id(parent?.assignedToUserId), id(parent?.createdBy)].filter(Boolean))];
  await recordWorkflowActivity({
    action: "workflow_changed",
    actorId: input.actorId,
    parentTaskId: input.parentTaskId,
    details: { subtaskId: input.subtaskId, dependencyId: input.dependencyId, message: input.title },
  });
  await Promise.all(
    recipients.map((recipientUserId) =>
      createWorkflowNotification({
        recipientUserId,
        actorId: input.actorId,
        type: "workflow_changed",
        title: input.title,
        body: input.body,
        parentTaskId: input.parentTaskId,
        subtaskId: input.subtaskId,
        dependencyId: input.dependencyId,
        dedupeKey: notificationDedupe("workflow_changed", input.parentTaskId, input.subtaskId, `${input.dependencyId ?? ""}:${Date.now()}`),
      }),
    ),
  );
}

export async function notifyCommentMentions(input: {
  parentTaskId: string;
  subtask: TaskLike;
  actorId: string;
  body: string;
}) {
  const matches = [...input.body.matchAll(/@([\w.+-]+@[\w.-]+\.\w+|[\w.-]+)/g)].map((match) => match[1]?.toLowerCase()).filter(Boolean);
  if (matches.length === 0) return;
  const users = await UserModel.find({
    $or: [{ email: { $in: matches } }, { fullName: { $in: matches.map((value) => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")) } }],
  }).select("_id fullName email").lean();
  await Promise.all(
    users.map(async (user) => {
      await recordWorkflowActivity({
        action: "subtask_comment_mention",
        actorId: input.actorId,
        parentTaskId: input.parentTaskId,
        details: { subtaskId: id(input.subtask._id), mentionedUserId: id(user._id), message: `mentioned ${user.fullName} on ${taskLabel(input.subtask)}` },
      });
      await createWorkflowNotification({
        recipientUserId: id(user._id),
        actorId: input.actorId,
        type: "comment_mention",
        title: `Mentioned on ${taskLabel(input.subtask)}`,
        body: input.body.slice(0, 240),
        parentTaskId: input.parentTaskId,
        subtaskId: id(input.subtask._id),
        dedupeKey: notificationDedupe("comment_mention", input.parentTaskId, id(input.subtask._id), `${id(user._id)}:${Date.now()}`),
      });
    }),
  );
}

export async function runWorkflowDueNotificationSweep(daysAhead = 2) {
  await connectToDatabase();
  const now = new Date();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + daysAhead);
  const approaching = await TaskModel.find({
    parentTaskId: { $ne: null },
    dueAt: { $gte: now, $lte: soon },
    status: { $nin: ["COMPLETED", "CANCELLED"] },
  }).lean();
  const overdue = await TaskModel.find({
    parentTaskId: { $ne: null },
    dueAt: { $lt: now },
    status: { $nin: ["COMPLETED", "CANCELLED"] },
  }).lean();

  await Promise.all([
    ...approaching.map(async (subtask) => {
      const parentTaskId = id(subtask.parentTaskId);
      await recordWorkflowActivity({
        action: "subtask_due_approaching",
        actorId: null,
        parentTaskId,
        details: { subtaskId: id(subtask._id), dueAt: subtask.dueAt, message: `${taskLabel(subtask)} is due soon` },
      });
      return createWorkflowNotification({
        recipientUserId: id(subtask.assignedToUserId),
        type: "due_date_approaching",
        title: `Due soon: ${taskLabel(subtask)}`,
        body: subtask.dueAt ? `Due ${new Date(subtask.dueAt).toLocaleDateString()}` : "",
        parentTaskId,
        subtaskId: id(subtask._id),
        dedupeKey: notificationDedupe("due_date_approaching", parentTaskId, id(subtask._id), new Date(subtask.dueAt as Date).toDateString()),
      });
    }),
    ...overdue.map(async (subtask) => {
      const parentTaskId = id(subtask.parentTaskId);
      await recordWorkflowActivity({
        action: "subtask_overdue",
        actorId: null,
        parentTaskId,
        details: { subtaskId: id(subtask._id), dueAt: subtask.dueAt, message: `${taskLabel(subtask)} is overdue` },
      });
      return createWorkflowNotification({
        recipientUserId: id(subtask.assignedToUserId),
        type: "subtask_overdue",
        title: `Overdue: ${taskLabel(subtask)}`,
        body: subtask.dueAt ? `Was due ${new Date(subtask.dueAt).toLocaleDateString()}` : "",
        parentTaskId,
        subtaskId: id(subtask._id),
        dedupeKey: notificationDedupe("subtask_overdue", parentTaskId, id(subtask._id), new Date(subtask.dueAt as Date).toDateString()),
      });
    }),
  ]);

  return { dueDateApproaching: approaching.length, overdue: overdue.length };
}

export async function getTaskActivity(parentTaskId: string, subtaskId?: string | null) {
  const query: Record<string, unknown> = { entityType: "task", entityId: parentTaskId };
  if (subtaskId) query["details.subtaskId"] = subtaskId;
  const logs = await ActivityLogModel.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("actorId", "fullName email role")
    .lean();
  return logs;
}

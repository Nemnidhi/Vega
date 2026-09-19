import { TaskModel, UserModel } from "@/models";
import { activeAdminIds, notifyUser, notifyUsers } from "@/lib/notifications/dispatch";

/**
 * Task notifications for whole tasks.
 *
 * The workflow module already covers subtasks in depth; these handle the
 * top-level task events that had no notification at all - creation, assignment,
 * status changes and overdue.
 *
 * All best-effort: the task write has already happened and must stand whether or
 * not anyone can be told.
 */

function taskUrl(taskId: string) {
  return `/tasks/${taskId}`;
}

function label(task: { code?: string | null; title: string }) {
  return `${task.code ? `${task.code} ` : ""}${task.title}`;
}

async function displayName(userId?: string | null) {
  if (!userId) return null;
  const user = await UserModel.findById(userId).select("fullName email").lean();
  return user?.fullName || user?.email || null;
}

/** Somebody now owns this task. Fires on creation and on later reassignment. */
export async function notifyTaskAssigned(input: {
  taskId: string;
  code?: string | null;
  title: string;
  assignedToUserId?: string | null;
  actorId: string;
  dueAt?: Date | string | null;
  isNew: boolean;
}) {
  if (!input.assignedToUserId) return;
  const who = await displayName(input.actorId);
  const due = input.dueAt ? ` - due ${new Date(input.dueAt).toLocaleDateString()}` : "";

  await notifyUser({
    recipientUserId: input.assignedToUserId,
    actorId: input.actorId,
    type: input.isNew ? "subtask_assigned" : "subtask_reassigned",
    title: input.isNew ? "New task assigned to you" : "Task reassigned to you",
    body: `${label(input)}${due}${who ? ` - by ${who}` : ""}`,
    entityType: "task",
    entityId: input.taskId,
    url: taskUrl(input.taskId),
    // Each hand-off is its own event, so the owner is part of the key.
    dedupeKey: `task_assigned:${input.taskId}:${input.assignedToUserId}`,
    metadata: { title: input.title },
  });
}

/**
 * Someone moved a task along. Admins are told because that is the progress they
 * are tracking; the assignee is not, since they are the one who just did it.
 */
export async function notifyTaskStatusChanged(input: {
  taskId: string;
  code?: string | null;
  title: string;
  from: string;
  to: string;
  actorId: string;
}) {
  const who = await displayName(input.actorId);
  const admins = await activeAdminIds();

  await notifyUsers(admins, {
    actorId: input.actorId,
    type: "workflow_changed",
    title: `Task ${input.to.toLowerCase().replaceAll("_", " ")}`,
    body: `${label(input)}${who ? ` - by ${who}` : ""}`,
    entityType: "task",
    entityId: input.taskId,
    url: taskUrl(input.taskId),
    // A genuine later change should notify again, so the key is not just the
    // transition - but Date.now() would make every key unique and let someone
    // toggling a dropdown spam every admin. Bucketed to the minute: repeated
    // changes while someone makes up their mind collapse into one.
    dedupeKey: `task_status:${input.taskId}:${input.to}:${new Date().toISOString().slice(0, 16)}`,
    metadata: { from: input.from, to: input.to },
  });
}

/**
 * Overdue top-level tasks. The workflow sweep only ever looked at subtasks
 * (parentTaskId != null), so a whole task could sail past its due date silently.
 */
export async function sweepOverdueTasks() {
  const now = new Date();
  const overdue = await TaskModel.find({
    parentTaskId: null,
    dueAt: { $lt: now },
    status: { $nin: ["COMPLETED", "CANCELLED"] },
    assignedToUserId: { $ne: null },
  })
    .select("code title dueAt assignedToUserId")
    .lean();

  await Promise.all(
    overdue.map((task) =>
      notifyUser({
        recipientUserId: String(task.assignedToUserId),
        actorId: null,
        type: "subtask_overdue",
        title: `Overdue: ${label(task as { code?: string; title: string })}`,
        body: task.dueAt ? `Was due ${new Date(task.dueAt).toLocaleDateString()}` : "",
        entityType: "task",
        entityId: String(task._id),
        url: taskUrl(String(task._id)),
        // Keyed to the day, so an overdue task nags once a day rather than on
        // every sweep run - but does keep nagging until it is dealt with.
        dedupeKey: `task_overdue:${task._id}:${now.toDateString()}`,
        metadata: { dueAt: task.dueAt },
      }),
    ),
  );

  return overdue.length;
}

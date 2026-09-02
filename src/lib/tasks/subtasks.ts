import { Types } from "mongoose";
import { assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { TaskModel } from "@/models";
import type { UserRole } from "@/types/user";

// Code generation and status handling moved into dedicated modules. Re-exported here so the many
// existing call sites keep their import path.
export { normalizeTaskCode, generateSubtaskCode, generateTaskCode } from "@/lib/tasks/codes";
export { getCompletionFields, normalizeTaskStatus, isCompletedStatus, isClosedStatus } from "@/lib/tasks/status";

export type TaskActor = {
  userId: string;
  role: UserRole;
};

type TaskAccessShape = {
  assignedToUserId?: unknown;
  createdBy?: unknown;
  parentTaskId?: unknown;
};

type ChecklistInput = {
  _id?: string;
  title: string;
  completed?: boolean;
  order?: number;
};

type AttachmentInput = {
  _id?: string;
  name: string;
  url: string;
  mimeType?: string;
  sizeBytes?: number | null;
};

type CommentInput = {
  _id?: string;
  body: string;
};

export function canAssignTasksToOthers(role: string) {
  return (permissionRules.assignTasksToOthers as string[]).includes(role);
}

export function canAccessTask(actor: TaskActor, task: TaskAccessShape) {
  if (canAssignTasksToOthers(actor.role)) return true;
  return String(task.assignedToUserId ?? "") === actor.userId || String(task.createdBy ?? "") === actor.userId;
}

export async function assertCanAccessTask(actor: TaskActor, task: TaskAccessShape) {
  if (canAccessTask(actor, task)) return;

  if (task.parentTaskId) {
    const parent = await TaskModel.findById(task.parentTaskId).select("assignedToUserId createdBy").lean();
    if (parent && canAccessTask(actor, parent)) return;
  }

  throw new Error("Forbidden");
}

export function assertCanAssignSubtask(actor: TaskActor, assignedToUserId?: string | null) {
  if (!assignedToUserId || assignedToUserId === actor.userId) return;
  assertRoleAccess(actor.role, { oneOf: permissionRules.assignTasksToOthers });
}

/**
 * These three take the *whole* array on every update, because that is the shape the PATCH
 * routes accept. That makes preserving what is already stored their responsibility: an entry
 * that arrives with an `_id` already exists, and stamping the current actor and time onto it
 * would silently reattribute someone else's comment, upload or tick-off to whoever happened
 * to edit the subtask next. Only entries with no `_id` are new and get stamped.
 *
 * Each takes the existing subdocuments so it can carry that provenance forward; callers that
 * genuinely have nothing stored yet pass an empty array.
 */

type ExistingWithId = { _id?: unknown };

function indexExistingById<T extends ExistingWithId>(existing: readonly T[] | undefined) {
  const byId = new Map<string, T>();
  for (const entry of existing ?? []) {
    if (entry?._id) byId.set(String(entry._id), entry);
  }
  return byId;
}

type ExistingAttachment = ExistingWithId & { uploadedBy?: unknown; uploadedAt?: Date | null };

export function normalizeAttachments(
  attachments: AttachmentInput[] | undefined,
  actor: TaskActor,
  existing?: readonly ExistingAttachment[],
) {
  const byId = indexExistingById(existing);

  return (attachments ?? []).map((attachment) => {
    const stored = attachment._id ? byId.get(String(attachment._id)) : undefined;

    return {
      ...(attachment._id ? { _id: new Types.ObjectId(attachment._id) } : {}),
      name: attachment.name,
      url: attachment.url,
      mimeType: attachment.mimeType ?? "",
      sizeBytes: attachment.sizeBytes ?? null,
      uploadedBy: stored?.uploadedBy ?? actor.userId,
      uploadedAt: stored?.uploadedAt ?? new Date(),
    };
  });
}

type ExistingComment = ExistingWithId & { body?: string; createdBy?: unknown; createdAt?: Date | null };

export function normalizeComments(
  comments: CommentInput[] | undefined,
  actor: TaskActor,
  existing?: readonly ExistingComment[],
) {
  const byId = indexExistingById(existing);

  return (comments ?? []).map((comment) => {
    const stored = comment._id ? byId.get(String(comment._id)) : undefined;
    if (!stored) {
      return {
        ...(comment._id ? { _id: new Types.ObjectId(comment._id) } : {}),
        body: comment.body,
        createdBy: actor.userId,
        createdAt: new Date(),
        updatedAt: null,
      };
    }

    // An existing comment keeps its author and creation time; only an actual change to the
    // body counts as an edit and moves updatedAt.
    const bodyChanged = stored.body !== comment.body;
    return {
      _id: new Types.ObjectId(String(comment._id)),
      body: comment.body,
      createdBy: stored.createdBy ?? actor.userId,
      createdAt: stored.createdAt ?? new Date(),
      updatedAt: bodyChanged ? new Date() : null,
    };
  });
}

type ExistingChecklistItem = ExistingWithId & {
  completed?: boolean;
  completedAt?: Date | null;
  completedBy?: unknown;
};

export function normalizeChecklist(
  checklist: ChecklistInput[] | undefined,
  actor: TaskActor,
  existing?: readonly ExistingChecklistItem[],
) {
  const byId = indexExistingById(existing);

  return (checklist ?? []).map((item, index) => {
    const completed = item.completed ?? false;
    const stored = item._id ? byId.get(String(item._id)) : undefined;

    // Who ticked an item off is recorded once, when it is ticked. Re-saving an already
    // completed item leaves that record alone; unticking clears it.
    const alreadyCompleted = stored?.completed === true;
    const completionFields =
      completed && alreadyCompleted
        ? { completedAt: stored?.completedAt ?? new Date(), completedBy: stored?.completedBy ?? actor.userId }
        : completed
          ? { completedAt: new Date(), completedBy: actor.userId }
          : { completedAt: null, completedBy: null };

    return {
      ...(item._id ? { _id: new Types.ObjectId(item._id) } : {}),
      title: item.title,
      completed,
      ...completionFields,
      order: item.order ?? index,
    };
  });
}

export function populateTaskRelations<TQuery extends { populate(path: string, select: string): TQuery }>(query: TQuery) {
  return query
    .populate("assignedToUserId", "fullName email role status")
    .populate("createdBy", "fullName email role status")
    .populate("attachments.uploadedBy", "fullName email role status")
    .populate("comments.createdBy", "fullName email role status")
    .populate("checklist.completedBy", "fullName email role status");
}

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

export function normalizeAttachments(attachments: AttachmentInput[] | undefined, actor: TaskActor) {
  return (attachments ?? []).map((attachment) => ({
    ...(attachment._id ? { _id: new Types.ObjectId(attachment._id) } : {}),
    name: attachment.name,
    url: attachment.url,
    mimeType: attachment.mimeType ?? "",
    sizeBytes: attachment.sizeBytes ?? null,
    uploadedBy: actor.userId,
    uploadedAt: new Date(),
  }));
}

export function normalizeComments(comments: CommentInput[] | undefined, actor: TaskActor) {
  return (comments ?? []).map((comment) => ({
    ...(comment._id ? { _id: new Types.ObjectId(comment._id) } : {}),
    body: comment.body,
    createdBy: actor.userId,
    createdAt: new Date(),
    updatedAt: null,
  }));
}

export function normalizeChecklist(checklist: ChecklistInput[] | undefined, actor: TaskActor) {
  return (checklist ?? []).map((item, index) => {
    const completed = item.completed ?? false;
    return {
      ...(item._id ? { _id: new Types.ObjectId(item._id) } : {}),
      title: item.title,
      completed,
      completedAt: completed ? new Date() : null,
      completedBy: completed ? actor.userId : null,
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

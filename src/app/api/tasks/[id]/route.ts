import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { objectIdSchema } from "@/lib/validation/common";
import { updateTaskSchema } from "@/lib/validation/task";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import type { UserRole } from "@/types/user";

type Params = Promise<{ id: string }>;

function canAssignOthers(role: string) {
  return (permissionRules.assignTasksToOthers as string[]).includes(role);
}

function canModify(actor: { userId: string; role: string }, task: { assignedToUserId: unknown; createdBy: unknown }) {
  if (canAssignOthers(actor.role)) return true;
  return String(task.assignedToUserId) === actor.userId || String(task.createdBy) === actor.userId;
}

function normalizeFlowSteps(
  steps:
    | Array<{ key: string; title: string; status?: "todo" | "in_progress" | "done"; order?: number }>
    | undefined,
) {
  return (steps ?? []).map((step, index) => ({
    key: step.key,
    title: step.title,
    status: step.status ?? "todo",
    order: step.order ?? index,
  }));
}

function normalizeSubTasks(
  subTasks:
    | Array<{
        _id?: string;
        title: string;
        description?: string;
        status?: "todo" | "in_progress" | "done";
        dueAt?: Date | null;
        assignedToUserId?: string | null;
        sourceSheet?: string;
        sourceRow?: number | null;
        order?: number;
      }>
    | undefined,
) {
  return (subTasks ?? []).map((subTask, index) => ({
    ...(subTask._id ? { _id: subTask._id } : {}),
    title: subTask.title,
    description: subTask.description ?? "",
    status: subTask.status ?? "todo",
    dueAt: subTask.dueAt ?? null,
    assignedToUserId: subTask.assignedToUserId ?? null,
    sourceSheet: subTask.sourceSheet ?? "",
    sourceRow: subTask.sourceRow ?? null,
    order: subTask.order ?? index,
    completedAt: subTask.status === "done" ? new Date() : null,
  }));
}

function assertSubTaskAssignees(
  actor: { userId: string; role: UserRole },
  subTasks: Array<{ assignedToUserId?: string | null }> | undefined,
) {
  if (!subTasks?.length) return;
  const assignsSomeoneElse = subTasks.some(
    (subTask) => subTask.assignedToUserId && subTask.assignedToUserId !== actor.userId,
  );
  if (assignsSomeoneElse) {
    assertRoleAccess(actor.role, { oneOf: permissionRules.assignTasksToOthers });
  }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    const { id } = await params;
    const taskId = objectIdSchema.parse(id);
    const payload = updateTaskSchema.parse(await request.json());

    const task = await TaskModel.findById(taskId);
    if (!task) {
      return fail("Task not found.", 404);
    }
    if (!canModify(actor, task)) {
      return fail("Forbidden", 403);
    }
    if (payload.assignedToUserId && payload.assignedToUserId !== String(task.assignedToUserId)) {
      assertRoleAccess(actor.role, { oneOf: permissionRules.assignTasksToOthers });
      task.assignedToUserId = payload.assignedToUserId as unknown as typeof task.assignedToUserId;
    }
    assertSubTaskAssignees(actor, payload.subTasks);

    if (payload.title !== undefined) task.title = payload.title;
    if (payload.description !== undefined) task.description = payload.description;
    if (payload.dueAt !== undefined) task.dueAt = payload.dueAt;
    if (payload.kpiId !== undefined) task.kpiId = payload.kpiId as unknown as typeof task.kpiId;
    if (payload.projectId !== undefined) task.projectId = payload.projectId as unknown as typeof task.projectId;
    if (payload.workflowTemplate !== undefined) task.workflowTemplate = payload.workflowTemplate;
    if (payload.flowSteps !== undefined) task.flowSteps = normalizeFlowSteps(payload.flowSteps) as typeof task.flowSteps;
    if (payload.subTasks !== undefined) task.subTasks = normalizeSubTasks(payload.subTasks) as typeof task.subTasks;
    if (payload.status !== undefined) {
      task.status = payload.status;
      task.completedAt = payload.status === "done" ? new Date() : null;
    }

    await task.save();

    const hydrated = await TaskModel.findById(task._id)
      .populate("assignedToUserId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .populate("subTasks.assignedToUserId", "fullName email role")
      .lean();

    return ok(serializeForJson(hydrated));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    const { id } = await params;
    const taskId = objectIdSchema.parse(id);

    const task = await TaskModel.findById(taskId);
    if (!task) {
      return fail("Task not found.", 404);
    }
    if (!canModify(actor, task)) {
      return fail("Forbidden", 403);
    }

    await TaskModel.deleteMany({ parentTaskId: taskId });
    await task.deleteOne();
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

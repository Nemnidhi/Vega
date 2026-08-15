import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { objectIdSchema } from "@/lib/validation/common";
import { updateTaskSchema } from "@/lib/validation/task";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

function canAssignOthers(role: string) {
  return (permissionRules.assignTasksToOthers as string[]).includes(role);
}

function canModify(actor: { userId: string; role: string }, task: { assignedToUserId: unknown; createdBy: unknown }) {
  if (canAssignOthers(actor.role)) return true;
  return String(task.assignedToUserId) === actor.userId || String(task.createdBy) === actor.userId;
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

    if (payload.title !== undefined) task.title = payload.title;
    if (payload.description !== undefined) task.description = payload.description;
    if (payload.dueAt !== undefined) task.dueAt = payload.dueAt;
    if (payload.kpiId !== undefined) task.kpiId = payload.kpiId as unknown as typeof task.kpiId;
    if (payload.status !== undefined) {
      task.status = payload.status;
      task.completedAt = payload.status === "done" ? new Date() : null;
    }

    await task.save();

    const hydrated = await TaskModel.findById(task._id)
      .populate("assignedToUserId", "fullName email role")
      .populate("createdBy", "fullName email role")
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

    await task.deleteOne();
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

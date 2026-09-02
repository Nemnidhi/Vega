import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { bulkUpdateTasksSchema } from "@/lib/validation/task";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { TaskModel } from "@/models";
import { logActivity } from "@/lib/activity/logging";
import { getCompletionFields, normalizeTaskStatus } from "@/lib/tasks/status";
import { assertValidProject } from "@/lib/tasks/hierarchy";

function canAssignOthers(role: string) {
  return (permissionRules.assignTasksToOthers as string[]).includes(role);
}

/**
 * Bulk assign / status / priority / due date / stage across root tasks.
 *
 * Authorisation is per-task, not per-request: the actor must be able to modify every task in the
 * set, or the whole call is refused. Partial application would leave the caller unable to tell
 * which rows changed.
 */
export async function PATCH(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    const payload = bulkUpdateTasksSchema.parse(await request.json());
    const { taskIds, patch } = payload;

    if (patch.assignedToUserId && patch.assignedToUserId !== actor.userId) {
      assertRoleAccess(actor.role, { oneOf: permissionRules.assignTasksToOthers });
    }
    if (patch.projectId !== undefined) {
      await assertValidProject(patch.projectId);
    }

    const tasks = await TaskModel.find({ _id: { $in: taskIds } })
      .select("assignedToUserId createdBy status code")
      .lean();

    if (tasks.length !== taskIds.length) {
      return fail("One or more tasks were not found.", 404);
    }

    if (!canAssignOthers(actor.role)) {
      const inaccessible = tasks.filter(
        (task) =>
          String(task.assignedToUserId ?? "") !== actor.userId &&
          String(task.createdBy ?? "") !== actor.userId,
      );
      if (inaccessible.length > 0) {
        return fail("Forbidden", 403);
      }
    }

    const update: Record<string, unknown> = {};
    if (patch.priority !== undefined) update.priority = patch.priority;
    if (patch.assignedToUserId !== undefined) update.assignedToUserId = patch.assignedToUserId;
    if (patch.dueAt !== undefined) update.dueAt = patch.dueAt;
    if (patch.stage !== undefined) update.stage = patch.stage;
    if (patch.projectId !== undefined) update.projectId = patch.projectId;

    if (patch.status !== undefined) {
      const status = normalizeTaskStatus(patch.status);
      const completion = getCompletionFields(status);
      update.status = status;
      update.completedAt = completion.completedAt;
      // Only force progress to 100 on completion; otherwise leave each task's own value alone.
      if (status === "COMPLETED") update.progressPercent = 100;
    }

    const result = await TaskModel.updateMany({ _id: { $in: taskIds } }, { $set: update });

    await logActivity({
      action: "task_bulk_updated",
      actorId: actor.userId,
      entityType: "task",
      // Bulk operations have no single entity; anchor the log on the first task and list the rest.
      entityId: taskIds[0],
      details: { taskIds, fields: Object.keys(patch), matched: result.matchedCount },
    });

    return ok({ matched: result.matchedCount, modified: result.modifiedCount });
  } catch (error) {
    return handleApiError(error);
  }
}

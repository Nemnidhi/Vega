import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { objectIdSchema } from "@/lib/validation/common";
import { updateTaskSchema } from "@/lib/validation/task";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { TaskDependencyModel, TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { logActivity } from "@/lib/activity/logging";
import { getCompletionFields, normalizeTaskStatus } from "@/lib/tasks/status";
import { recalculateSuccessorsForPredecessor } from "@/lib/tasks/dependencies";
import { syncParentTaskProgress } from "@/lib/tasks/workflow-execution";
import { normalizeChecklist } from "@/lib/tasks/subtasks";
import {
  assertValidParent,
  assertValidProject,
  assertValidDateRange,
  collectDescendantIds,
} from "@/lib/tasks/hierarchy";

type Params = Promise<{ id: string }>;

function canAssignOthers(role: string) {
  return (permissionRules.assignTasksToOthers as string[]).includes(role);
}

function canModify(actor: { userId: string; role: string }, task: { assignedToUserId: unknown; createdBy: unknown }) {
  if (canAssignOthers(actor.role)) return true;
  return String(task.assignedToUserId) === actor.userId || String(task.createdBy) === actor.userId;
}

export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    const { id } = await params;
    const taskId = objectIdSchema.parse(id);

    const task = await TaskModel.findById(taskId)
      .populate("assignedToUserId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .lean();

    if (!task) {
      return fail("Task not found.", 404);
    }
    if (!canModify(actor, task as { assignedToUserId: unknown; createdBy: unknown })) {
      return fail("Forbidden", 403);
    }

    return ok(serializeForJson(task));
  } catch (error) {
    return handleApiError(error);
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

    const previousStatus = normalizeTaskStatus(task.status);
    const previousAssignee = String(task.assignedToUserId ?? "");
    const previousParentId = task.parentTaskId ? String(task.parentTaskId) : null;

    if (payload.assignedToUserId && payload.assignedToUserId !== previousAssignee) {
      assertRoleAccess(actor.role, { oneOf: permissionRules.assignTasksToOthers });
      task.assignedToUserId = payload.assignedToUserId as unknown as typeof task.assignedToUserId;
    }

    if (payload.projectId !== undefined) {
      await assertValidProject(payload.projectId);
      task.projectId = payload.projectId as unknown as typeof task.projectId;
    }

    if (payload.parentTaskId !== undefined) {
      if (payload.parentTaskId === null) {
        task.parentTaskId = null as unknown as typeof task.parentTaskId;
        task.rootTaskId = null as unknown as typeof task.rootTaskId;
      } else {
        const rootTaskId = await assertValidParent(taskId, payload.parentTaskId, {
          projectId: payload.projectId !== undefined ? payload.projectId : (task.projectId ? String(task.projectId) : null),
        });
        task.parentTaskId = payload.parentTaskId as unknown as typeof task.parentTaskId;
        task.rootTaskId = rootTaskId as unknown as typeof task.rootTaskId;
      }
    }

    if (payload.title !== undefined) task.title = payload.title;
    if (payload.description !== undefined) task.description = payload.description;
    if (payload.priority !== undefined) task.priority = payload.priority;
    if (payload.startAt !== undefined) task.startAt = payload.startAt;
    if (payload.dueAt !== undefined) task.dueAt = payload.dueAt;
    if (payload.estimatedEffortHours !== undefined) task.estimatedEffortHours = payload.estimatedEffortHours;
    if (payload.actualEffortHours !== undefined) task.actualEffortHours = payload.actualEffortHours;
    if (payload.tags !== undefined) task.tags = payload.tags;
    if (payload.stage !== undefined) task.stage = payload.stage;
    if (payload.kpiId !== undefined) task.kpiId = payload.kpiId as unknown as typeof task.kpiId;
    if (payload.leadId !== undefined) task.leadId = payload.leadId as unknown as typeof task.leadId;
    if (payload.clientId !== undefined) task.clientId = payload.clientId as unknown as typeof task.clientId;
    if (payload.checklist !== undefined) {
      task.checklist = normalizeChecklist(payload.checklist, actor, task.checklist) as typeof task.checklist;
    }

    if (payload.status !== undefined) {
      const status = normalizeTaskStatus(payload.status);
      const completion = getCompletionFields(status, payload.progressPercent ?? task.progressPercent);
      task.status = status;
      task.completedAt = completion.completedAt;
      task.progressPercent = completion.progressPercent;
    } else if (payload.progressPercent !== undefined) {
      task.progressPercent = payload.progressPercent;
    }

    assertValidDateRange(task.startAt ?? null, task.dueAt ?? null);

    await task.save();

    const nextStatus = normalizeTaskStatus(task.status);
    const nextAssignee = String(task.assignedToUserId ?? "");

    // This route accepts any task id, child tasks included, so a subtask can have its status
    // changed here rather than through /api/tasks/[id]/subtasks/[subtaskId]. Those routes run
    // the workflow engine afterwards and this one did not, so completing a child here left
    // its successors blocked forever and its parent's progress stale. Reparenting has to
    // resync both the old and new parent, since the child left one tree and joined another.
    const parentsToResync = new Set<string>();
    if (previousParentId) parentsToResync.add(previousParentId);
    if (task.parentTaskId) parentsToResync.add(String(task.parentTaskId));

    if (parentsToResync.size > 0 && nextStatus !== previousStatus) {
      await recalculateSuccessorsForPredecessor(taskId);
    }
    for (const parentId of parentsToResync) {
      await syncParentTaskProgress(parentId);
    }

    await logActivity({
      action: "task_updated",
      actorId: actor.userId,
      entityType: "task",
      entityId: String(task._id),
      details: { code: task.code ?? null, fields: Object.keys(payload) },
    });

    if (nextStatus !== previousStatus) {
      await logActivity({
        action: "task_status_changed",
        actorId: actor.userId,
        entityType: "task",
        entityId: String(task._id),
        details: { code: task.code ?? null, from: previousStatus, to: nextStatus },
      });
    }

    if (nextAssignee !== previousAssignee) {
      await logActivity({
        action: "task_assigned",
        actorId: actor.userId,
        entityType: "task",
        entityId: String(task._id),
        details: { code: task.code ?? null, from: previousAssignee || null, to: nextAssignee },
      });
    }

    const hydrated = await TaskModel.findById(task._id)
      .populate("assignedToUserId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .lean();

    return ok(serializeForJson(hydrated));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Archive by default; `?hard=1` still deletes.
 *
 * The previous behaviour hard-deleted the task and every child, which orphaned TaskDependency
 * rows, ImportJob.createdSubtaskIds and Notification references. Archiving keeps the graph
 * consistent, and the hard path now cleans up the dependency edges it invalidates.
 */
export async function DELETE(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    const { id } = await params;
    const taskId = objectIdSchema.parse(id);
    const hardDelete = new URL(request.url).searchParams.get("hard") === "1";

    const task = await TaskModel.findById(taskId);
    if (!task) {
      return fail("Task not found.", 404);
    }
    if (!canModify(actor, task)) {
      return fail("Forbidden", 403);
    }

    const descendantIds = await collectDescendantIds(taskId);
    const affectedIds = [taskId, ...descendantIds];

    if (hardDelete) {
      // Only roles that can assign work may destroy records outright.
      assertRoleAccess(actor.role, { oneOf: permissionRules.assignTasksToOthers });

      await TaskDependencyModel.deleteMany({
        $or: [
          { predecessorSubtaskId: { $in: affectedIds } },
          { successorSubtaskId: { $in: affectedIds } },
        ],
      });
      await TaskModel.deleteMany({ _id: { $in: descendantIds } });
      await task.deleteOne();

      await logActivity({
        action: "task_archived",
        actorId: actor.userId,
        entityType: "task",
        entityId: taskId,
        details: { code: task.code ?? null, hardDeleted: true, descendants: descendantIds.length },
      });

      return ok({ deleted: true, descendants: descendantIds.length });
    }

    const archivedAt = new Date();
    await TaskModel.updateMany(
      { _id: { $in: affectedIds } },
      { $set: { archivedAt, archivedBy: actor.userId } },
    );

    await logActivity({
      action: "task_archived",
      actorId: actor.userId,
      entityType: "task",
      entityId: taskId,
      details: { code: task.code ?? null, hardDeleted: false, descendants: descendantIds.length },
    });

    return ok({ archived: true, descendants: descendantIds.length });
  } catch (error) {
    return handleApiError(error);
  }
}

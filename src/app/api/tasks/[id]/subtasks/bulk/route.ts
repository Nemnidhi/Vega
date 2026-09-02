import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { recalculateSuccessorsForPredecessor } from "@/lib/tasks/dependencies";
import { notifyDependencyCompleted, notifySubtaskStateChange } from "@/lib/notifications/workflow";
import { syncParentTaskProgress } from "@/lib/tasks/workflow-execution";
import { assertCanAccessTask, assertCanAssignSubtask, getCompletionFields } from "@/lib/tasks/subtasks";
import { objectIdSchema } from "@/lib/validation/common";
import { bulkUpdateSubtasksSchema } from "@/lib/validation/task";
import { TaskModel } from "@/models";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id } = await params;
    const parentTaskId = objectIdSchema.parse(id);
    const payload = bulkUpdateSubtasksSchema.parse(await request.json());

    const parent = await TaskModel.findById(parentTaskId).select("assignedToUserId createdBy").lean();
    if (!parent) return fail("Task not found.", 404);
    await assertCanAccessTask(actor, parent);
    if (payload.patch.assignedToUserId !== undefined) {
      assertCanAssignSubtask(actor, payload.patch.assignedToUserId);
    }

    const count = await TaskModel.countDocuments({ _id: { $in: payload.subtaskIds }, parentTaskId });
    if (count !== payload.subtaskIds.length) {
      return fail("One or more subtasks do not belong to this task.", 422);
    }
    if (payload.patch.startAt !== undefined || payload.patch.dueAt !== undefined) {
      const dateRows = await TaskModel.find({ _id: { $in: payload.subtaskIds }, parentTaskId })
        .select("startAt dueAt")
        .lean();
      const hasInvalidDateRange = dateRows.some((subtask) => {
        const nextStartAt = payload.patch.startAt !== undefined ? payload.patch.startAt : subtask.startAt;
        const nextDueAt = payload.patch.dueAt !== undefined ? payload.patch.dueAt : subtask.dueAt;
        return Boolean(nextStartAt && nextDueAt && new Date(nextStartAt).getTime() > new Date(nextDueAt).getTime());
      });
      if (hasInvalidDateRange) {
        return fail("Due date cannot be before start date.", 422);
      }
    }

    const patch: Record<string, unknown> = { ...payload.patch };
    if (payload.patch.status || payload.patch.progressPercent !== undefined) {
      const completion = getCompletionFields(payload.patch.status, payload.patch.progressPercent);
      patch.completedAt = completion.completedAt;
      patch.progressPercent = completion.progressPercent;
    }

    const previousSubtasks = payload.patch.status
      ? await TaskModel.find({ _id: { $in: payload.subtaskIds }, parentTaskId })
          .select("_id status")
          .lean()
      : [];
    const previousStatusById = new Map(previousSubtasks.map((subtask) => [String(subtask._id), String(subtask.status)]));

    const result = await TaskModel.updateMany(
      { _id: { $in: payload.subtaskIds }, parentTaskId },
      { $set: patch },
      { runValidators: true },
    );
    if (payload.patch.status) {
      const updatedSubtasks = await TaskModel.find({ _id: { $in: payload.subtaskIds }, parentTaskId })
        .select("code title assignedToUserId status")
        .lean();
      const recalculated = await Promise.all(
        payload.subtaskIds.map((subtaskId) => recalculateSuccessorsForPredecessor(subtaskId)),
      );
      await Promise.all([
        ...updatedSubtasks
          .filter((subtask) => previousStatusById.get(String(subtask._id)) !== String(subtask.status))
          .map(async (subtask) => {
            await notifySubtaskStateChange({
              subtask,
              parentTaskId,
              actorId: actor.userId,
              previousStatus: previousStatusById.get(String(subtask._id)),
              nextStatus: String(subtask.status),
            });
            if (String(subtask.status) === "COMPLETED") {
              await notifyDependencyCompleted(subtask, actor.userId, parentTaskId);
            }
          }),
        ...recalculated
          .flat()
          .filter((item): item is NonNullable<typeof item> => {
            if (!item) return false;
            return item.changed && ["READY", "BLOCKED"].includes(item.nextStatus);
          })
          .map((item) =>
            notifySubtaskStateChange({
              subtask: item.subtask,
              parentTaskId,
              actorId: actor.userId,
              previousStatus: item.previousStatus,
              nextStatus: item.nextStatus,
            }),
          ),
      ]);
    }
    await syncParentTaskProgress(parentTaskId);

    return ok({ matched: result.matchedCount, modified: result.modifiedCount });
  } catch (error) {
    return handleApiError(error);
  }
}

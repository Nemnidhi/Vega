import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { notifyAssignmentChange } from "@/lib/notifications/workflow";
import { assertCanAccessTask, assertCanAssignSubtask } from "@/lib/tasks/subtasks";
import { objectIdSchema } from "@/lib/validation/common";
import { bulkAssignSubtasksSchema } from "@/lib/validation/task";
import { TaskModel } from "@/models";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id } = await params;
    const parentTaskId = objectIdSchema.parse(id);
    const payload = bulkAssignSubtasksSchema.parse(await request.json());

    const parent = await TaskModel.findById(parentTaskId).select("assignedToUserId createdBy").lean();
    if (!parent) return fail("Task not found.", 404);
    await assertCanAccessTask(actor, parent);
    assertCanAssignSubtask(actor, payload.assignedToUserId);

    const count = await TaskModel.countDocuments({ _id: { $in: payload.subtaskIds }, parentTaskId });
    if (count !== payload.subtaskIds.length) {
      return fail("One or more subtasks do not belong to this task.", 422);
    }

    const previousSubtasks = await TaskModel.find({ _id: { $in: payload.subtaskIds }, parentTaskId })
      .select("code title assignedToUserId")
      .lean();

    const result = await TaskModel.updateMany(
      { _id: { $in: payload.subtaskIds }, parentTaskId },
      { $set: { assignedToUserId: payload.assignedToUserId } },
      { runValidators: true },
    );
    const updatedSubtasks = await TaskModel.find({ _id: { $in: payload.subtaskIds }, parentTaskId })
      .select("code title assignedToUserId")
      .lean();
    const previousAssigneeById = new Map(
      previousSubtasks.map((subtask) => [String(subtask._id), String(subtask.assignedToUserId ?? "")]),
    );

    await Promise.all(
      updatedSubtasks.map((subtask) =>
        notifyAssignmentChange({
          subtask,
          parentTaskId,
          actorId: actor.userId,
          previousAssigneeId: previousAssigneeById.get(String(subtask._id)) ?? "",
          nextAssigneeId: String(subtask.assignedToUserId ?? ""),
        }),
      ),
    );

    return ok({ matched: result.matchedCount, modified: result.modifiedCount });
  } catch (error) {
    return handleApiError(error);
  }
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertCanAccessTask } from "@/lib/tasks/subtasks";
import { objectIdSchema } from "@/lib/validation/common";
import { reorderSubtasksSchema } from "@/lib/validation/task";
import { TaskModel } from "@/models";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id } = await params;
    const parentTaskId = objectIdSchema.parse(id);
    const payload = reorderSubtasksSchema.parse(await request.json());

    const parent = await TaskModel.findById(parentTaskId).select("assignedToUserId createdBy").lean();
    if (!parent) return fail("Task not found.", 404);
    await assertCanAccessTask(actor, parent);

    const subtaskIds = payload.subtasks.map((item) => item.id);
    const count = await TaskModel.countDocuments({ _id: { $in: subtaskIds }, parentTaskId });
    if (count !== subtaskIds.length) {
      return fail("One or more subtasks do not belong to this task.", 422);
    }

    await Promise.all(
      payload.subtasks.map((item) =>
        TaskModel.updateOne({ _id: item.id, parentTaskId }, { $set: { order: item.order } }),
      ),
    );

    return ok({ reordered: payload.subtasks.length });
  } catch (error) {
    return handleApiError(error);
  }
}

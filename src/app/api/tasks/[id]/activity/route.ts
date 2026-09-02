import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { getTaskActivity } from "@/lib/notifications/workflow";
import { assertCanAccessTask } from "@/lib/tasks/subtasks";
import { objectIdSchema } from "@/lib/validation/common";
import { TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id } = await params;
    const parentTaskId = objectIdSchema.parse(id);
    const { searchParams } = new URL(request.url);
    const subtaskId = searchParams.get("subtaskId");

    const parent = await TaskModel.findById(parentTaskId).select("assignedToUserId createdBy").lean();
    if (!parent) return fail("Task not found.", 404);
    await assertCanAccessTask(actor, parent);

    if (subtaskId) {
      const parsedSubtaskId = objectIdSchema.parse(subtaskId);
      const exists = await TaskModel.exists({ _id: parsedSubtaskId, parentTaskId });
      if (!exists) return fail("Subtask not found.", 404);
      const logs = await getTaskActivity(parentTaskId, parsedSubtaskId);
      return ok(serializeForJson(logs));
    }

    const logs = await getTaskActivity(parentTaskId);
    return ok(serializeForJson(logs));
  } catch (error) {
    return handleApiError(error);
  }
}

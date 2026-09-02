import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { assertCanAccessTask } from "@/lib/tasks/subtasks";
import { getWorkflowExecutionSummary, syncParentTaskProgress } from "@/lib/tasks/workflow-execution";
import { objectIdSchema } from "@/lib/validation/common";
import { TaskModel } from "@/models";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id } = await params;
    const parentTaskId = objectIdSchema.parse(id);

    const parent = await TaskModel.findById(parentTaskId).select("assignedToUserId createdBy").lean();
    if (!parent) return fail("Task not found.", 404);
    await assertCanAccessTask(actor, parent);

    await syncParentTaskProgress(parentTaskId);
    const summary = await getWorkflowExecutionSummary(parentTaskId);
    return ok(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

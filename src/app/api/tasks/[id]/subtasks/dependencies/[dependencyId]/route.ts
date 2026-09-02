import { connectToDatabase } from "@/lib/db/mongodb";
import { logActivity } from "@/lib/activity/logging";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { deleteDependency, getDependencyMap } from "@/lib/tasks/dependencies";
import { notifySubtaskStateChange, notifyWorkflowChanged } from "@/lib/notifications/workflow";
import { assertCanAccessTask } from "@/lib/tasks/subtasks";
import { objectIdSchema } from "@/lib/validation/common";
import { TaskDependencyModel, TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string; dependencyId: string }>;

export async function DELETE(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id, dependencyId } = await params;
    const parentTaskId = objectIdSchema.parse(id);
    const parsedDependencyId = objectIdSchema.parse(dependencyId);

    const parent = await TaskModel.findById(parentTaskId).select("assignedToUserId createdBy").lean();
    if (!parent) return fail("Task not found.", 404);
    await assertCanAccessTask(actor, parent);

    const existingDependency = await TaskDependencyModel.findOne({ _id: parsedDependencyId, parentTaskId })
      .populate("successorSubtaskId", "status")
      .lean();
    const successor = existingDependency?.successorSubtaskId as { _id?: unknown; status?: string } | string | undefined;
    const successorId = String(typeof successor === "object" ? successor._id ?? "" : successor ?? "");
    const previousStatus = String(typeof successor === "object" ? successor.status ?? "" : "");
    const dependency = await deleteDependency(parentTaskId, parsedDependencyId);
    const successorAfter = successorId
      ? await TaskModel.findById(successorId).select("code title assignedToUserId status").lean()
      : null;
    await logActivity({
      action: "subtask_dependency_removed",
      actorId: actor.userId,
      entityType: "task",
      entityId: parentTaskId,
      details: {
        dependencyId: parsedDependencyId,
        predecessorSubtaskId: String(dependency.predecessorSubtaskId),
        successorSubtaskId: String(dependency.successorSubtaskId),
        dependencyType: dependency.dependencyType,
      },
    });
    await notifyWorkflowChanged({
      parentTaskId,
      actorId: actor.userId,
      title: `Removed dependency ${parsedDependencyId}`,
      body: "A subtask dependency was removed from the workflow.",
      subtaskId: successorId,
      dependencyId: parsedDependencyId,
    });
    if (
      successorAfter &&
      previousStatus &&
      String(successorAfter.status) !== previousStatus &&
      ["READY", "BLOCKED"].includes(String(successorAfter.status))
    ) {
      await notifySubtaskStateChange({
        subtask: successorAfter,
        parentTaskId,
        actorId: actor.userId,
        previousStatus,
        nextStatus: String(successorAfter.status),
      });
    }

    const dependencyMap = await getDependencyMap(parentTaskId);
    return ok(serializeForJson(dependencyMap.dependencies));
  } catch (error) {
    return handleApiError(error);
  }
}

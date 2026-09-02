import { connectToDatabase } from "@/lib/db/mongodb";
import { logActivity } from "@/lib/activity/logging";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { createDependency, getDependencyMap } from "@/lib/tasks/dependencies";
import { notifySubtaskStateChange, notifyWorkflowChanged } from "@/lib/notifications/workflow";
import { assertCanAccessTask } from "@/lib/tasks/subtasks";
import { objectIdSchema } from "@/lib/validation/common";
import { createSubtaskDependencySchema } from "@/lib/validation/task";
import { TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

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

    const dependencyMap = await getDependencyMap(parentTaskId);
    return ok(dependencyMap.dependencies);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id } = await params;
    const parentTaskId = objectIdSchema.parse(id);
    const payload = createSubtaskDependencySchema.parse(await request.json());

    const parent = await TaskModel.findById(parentTaskId).select("assignedToUserId createdBy").lean();
    if (!parent) return fail("Task not found.", 404);
    await assertCanAccessTask(actor, parent);

    const successorBefore = await TaskModel.findOne({
      _id: payload.successorSubtaskId,
      parentTaskId,
    })
      .select("status")
      .lean();
    const dependency = await createDependency({ parentTaskId, ...payload }, actor);
    const successorAfter = await TaskModel.findById(payload.successorSubtaskId).select("code title assignedToUserId status").lean();
    await logActivity({
      action: "subtask_dependency_added",
      actorId: actor.userId,
      entityType: "task",
      entityId: parentTaskId,
      details: {
        dependencyId: String(dependency._id),
        predecessorSubtaskId: payload.predecessorSubtaskId,
        successorSubtaskId: payload.successorSubtaskId,
        dependencyType: payload.dependencyType,
        branchKey: payload.branchKey,
        branchLabel: payload.branchLabel,
      },
    });
    await notifyWorkflowChanged({
      parentTaskId,
      actorId: actor.userId,
      title: `Connected ${payload.predecessorSubtaskId} -> ${payload.successorSubtaskId}`,
      body: "A subtask dependency was added to the workflow.",
      subtaskId: payload.successorSubtaskId,
      dependencyId: String(dependency._id),
    });
    if (
      successorAfter &&
      successorBefore &&
      String(successorAfter.status) !== String(successorBefore.status) &&
      ["READY", "BLOCKED"].includes(String(successorAfter.status))
    ) {
      await notifySubtaskStateChange({
        subtask: successorAfter,
        parentTaskId,
        actorId: actor.userId,
        previousStatus: String(successorBefore.status),
        nextStatus: String(successorAfter.status),
      });
    }

    const dependencyMap = await getDependencyMap(parentTaskId);
    return ok(serializeForJson(dependencyMap.dependencies), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

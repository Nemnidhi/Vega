import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { notifyWorkflowChanged } from "@/lib/notifications/workflow";
import { assertCanAccessTask, populateTaskRelations } from "@/lib/tasks/subtasks";
import { objectIdSchema } from "@/lib/validation/common";
import { updateWorkflowLayoutSchema } from "@/lib/validation/task";
import { TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id } = await params;
    const parentTaskId = objectIdSchema.parse(id);
    const payload = updateWorkflowLayoutSchema.parse(await request.json());

    const parent = await TaskModel.findById(parentTaskId).select("assignedToUserId createdBy").lean();
    if (!parent) return fail("Task not found.", 404);
    await assertCanAccessTask(actor, parent);

    const nodeIds = payload.nodes.map((node) => node.id);
    const ownedCount = await TaskModel.countDocuments({ _id: { $in: nodeIds }, parentTaskId });
    if (ownedCount !== nodeIds.length) {
      return fail("One or more workflow nodes do not belong to this task.", 400);
    }

    if (payload.nodes.length > 0) {
      await TaskModel.bulkWrite(
        payload.nodes.map((node) => ({
          updateOne: {
            filter: { _id: node.id, parentTaskId },
            update: {
              $set: {
                workflowPositionX: node.positionX,
                workflowPositionY: node.positionY,
                workflowWidth: node.width ?? null,
                workflowCollapsed: node.collapsed ?? false,
                workflowGroup: node.group ?? "",
              },
            },
          },
        })),
      );
    }

    if (payload.stages !== undefined) {
      await TaskModel.updateOne(
        { _id: parentTaskId },
        {
          $set: {
            workflowStages: payload.stages.map((stage) => ({
              key: stage.key,
              name: stage.name,
              color: stage.color || "accent",
              collapsed: stage.collapsed,
              order: stage.order,
            })),
          },
        },
      );
    }

    await notifyWorkflowChanged({
      parentTaskId,
      actorId: actor.userId,
      title: "Workflow layout updated",
      body: payload.stages !== undefined ? "Workflow stages and node layout were updated." : "Workflow node layout was updated.",
    });

    const updated = await populateTaskRelations(
      TaskModel.find({ parentTaskId }).sort({ order: 1, createdAt: 1 }),
    ).lean();

    return ok(serializeForJson(updated));
  } catch (error) {
    return handleApiError(error);
  }
}

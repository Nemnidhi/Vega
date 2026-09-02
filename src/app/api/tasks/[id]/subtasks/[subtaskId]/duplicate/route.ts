import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { notifySubtaskCreated } from "@/lib/notifications/workflow";
import { assertCanAccessTask, generateSubtaskCode, populateTaskRelations } from "@/lib/tasks/subtasks";
import { objectIdSchema } from "@/lib/validation/common";
import { TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string; subtaskId: string }>;

export async function POST(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id, subtaskId } = await params;
    const parentTaskId = objectIdSchema.parse(id);
    const parsedSubtaskId = objectIdSchema.parse(subtaskId);

    const [parent, source] = await Promise.all([
      TaskModel.findById(parentTaskId).select("assignedToUserId createdBy").lean(),
      TaskModel.findOne({ _id: parsedSubtaskId, parentTaskId }).lean(),
    ]);
    if (!parent) return fail("Task not found.", 404);
    if (!source) return fail("Subtask not found.", 404);
    await assertCanAccessTask(actor, source);

    const order = await TaskModel.countDocuments({ parentTaskId });
    const duplicated = await TaskModel.create({
      title: `${source.title} Copy`,
      description: source.description ?? "",
      status: "NOT_STARTED",
      priority: source.priority ?? "MEDIUM",
      assignedToUserId: source.assignedToUserId,
      createdBy: actor.userId,
      code: await generateSubtaskCode(parentTaskId),
      parentTaskId,
      rootTaskId: source.rootTaskId ?? parentTaskId,
      projectId: source.projectId ?? null,
      startAt: source.startAt ?? null,
      dueAt: source.dueAt ?? null,
      estimatedEffortHours: source.estimatedEffortHours ?? null,
      actualEffortHours: null,
      progressPercent: 0,
      completedAt: null,
      tags: source.tags ?? [],
      stage: source.stage ?? "",
      order,
      workflowTemplate: "custom",
      attachments: source.attachments ?? [],
      checklist: (source.checklist ?? []).map((item: { title: string; order?: number }, index: number) => ({
        title: item.title,
        completed: false,
        completedAt: null,
        completedBy: null,
        order: item.order ?? index,
      })),
      comments: [],
    });

    const hydrated = await populateTaskRelations(TaskModel.findById(duplicated._id)).lean();
    await notifySubtaskCreated(duplicated, actor.userId, parentTaskId);
    return ok(serializeForJson(hydrated), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

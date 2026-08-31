import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { getDependencyMap } from "@/lib/tasks/dependencies";
import { syncParentTaskProgress } from "@/lib/tasks/workflow-execution";
import { notifySubtaskCreated } from "@/lib/notifications/workflow";
import { assertCanAccessTask, assertCanAssignSubtask, generateSubtaskCode, getCompletionFields, normalizeAttachments, normalizeChecklist, normalizeComments, populateTaskRelations } from "@/lib/tasks/subtasks";
import { createAdvancedSubtaskSchema } from "@/lib/validation/task";
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

    const parent = await TaskModel.findById(parentTaskId).select("assignedToUserId createdBy").lean();
    if (!parent) return fail("Task not found.", 404);
    await assertCanAccessTask(actor, parent);

    const { searchParams } = new URL(request.url);
    const query: Record<string, unknown> = { parentTaskId };
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const assignee = searchParams.get("assignedToUserId");
    const search = searchParams.get("q")?.trim();

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignee) query.assignedToUserId = assignee;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    const subtasks = await populateTaskRelations(
      TaskModel.find(query).sort({ order: 1, createdAt: 1 }),
    ).lean();
    const dependencyMap = await getDependencyMap(parentTaskId);
    const subtasksWithDependencies = subtasks.map((subtask) => ({
      ...subtask,
      blockedBy: dependencyMap.bySuccessor.get(String(subtask._id)) ?? [],
      blocking: dependencyMap.byPredecessor.get(String(subtask._id)) ?? [],
    }));

    return ok(serializeForJson(subtasksWithDependencies));
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
    const payload = createAdvancedSubtaskSchema.parse(await request.json());
    if (payload.startAt && payload.dueAt && payload.startAt > payload.dueAt) {
      return fail("Due date cannot be before start date.", 422);
    }

    const parent = await TaskModel.findById(parentTaskId).select("assignedToUserId createdBy projectId rootTaskId").lean();
    if (!parent) return fail("Task not found.", 404);
    await assertCanAccessTask(actor, parent);

    const assignedToUserId = payload.assignedToUserId ?? String(parent.assignedToUserId);
    assertCanAssignSubtask(actor, assignedToUserId);

    const order = await TaskModel.countDocuments({ parentTaskId });
    const completion = getCompletionFields(payload.status, payload.progressPercent);
    const subtask = await TaskModel.create({
      code: await generateSubtaskCode(parentTaskId, payload.code),
      title: payload.title,
      description: payload.description ?? "",
      status: payload.status,
      priority: payload.priority,
      assignedToUserId,
      createdBy: actor.userId,
      parentTaskId,
      rootTaskId: parent.rootTaskId ?? parentTaskId,
      projectId: payload.projectId ?? parent.projectId ?? null,
      startAt: payload.startAt ?? null,
      dueAt: payload.dueAt ?? null,
      estimatedEffortHours: payload.estimatedEffortHours ?? null,
      actualEffortHours: payload.actualEffortHours ?? null,
      progressPercent: completion.progressPercent,
      completedAt: completion.completedAt,
      tags: payload.tags ?? [],
      stage: payload.stage ?? "",
      order,
      workflowNodeType: payload.workflowNodeType ?? "SUBTASK",
      workflowGroup: payload.workflowGroup ?? payload.stage ?? "",
      workflowDecision: payload.workflowDecision ?? "",
      workflowTemplate: "custom",
      attachments: normalizeAttachments(payload.attachments, actor),
      comments: normalizeComments(payload.comments, actor),
      checklist: normalizeChecklist(payload.checklist, actor),
    });

    const hydrated = await populateTaskRelations(TaskModel.findById(subtask._id)).lean();
    await syncParentTaskProgress(parentTaskId);
    await notifySubtaskCreated(subtask, actor.userId, parentTaskId);
    return ok(serializeForJson(hydrated), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

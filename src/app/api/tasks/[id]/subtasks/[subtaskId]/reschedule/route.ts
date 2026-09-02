import { connectToDatabase } from "@/lib/db/mongodb";
import { logActivity } from "@/lib/activity/logging";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { notifyWorkflowChanged } from "@/lib/notifications/workflow";
import { assertCanAccessTask, populateTaskRelations } from "@/lib/tasks/subtasks";
import { syncParentTaskProgress } from "@/lib/tasks/workflow-execution";
import { objectIdSchema } from "@/lib/validation/common";
import { rescheduleSubtaskSchema } from "@/lib/validation/task";
import { TaskDependencyModel, TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string; subtaskId: string }>;

function midnight(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function diffDays(from: Date | null | undefined, to: Date | null | undefined) {
  if (!from || !to) return 0;
  return Math.round((midnight(to).getTime() - midnight(from).getTime()) / 86_400_000);
}

function addDays(value: Date | null | undefined, days: number) {
  if (!value || days === 0) return value ?? null;
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

async function getSuccessorIds(parentTaskId: string, subtaskId: string) {
  const dependencies = await TaskDependencyModel.find({ parentTaskId }).select("predecessorSubtaskId successorSubtaskId").lean();
  const successors = new Map<string, string[]>();
  dependencies.forEach((dependency) => {
    const predecessor = String(dependency.predecessorSubtaskId);
    const successor = String(dependency.successorSubtaskId);
    successors.set(predecessor, [...(successors.get(predecessor) ?? []), successor]);
  });

  const impacted = new Set<string>();
  const stack = [...(successors.get(subtaskId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || impacted.has(current)) continue;
    impacted.add(current);
    stack.push(...(successors.get(current) ?? []));
  }

  return [...impacted];
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id, subtaskId } = await params;
    const parentTaskId = objectIdSchema.parse(id);
    const parsedSubtaskId = objectIdSchema.parse(subtaskId);
    const payload = rescheduleSubtaskSchema.parse(await request.json());

    const [parent, subtask] = await Promise.all([
      TaskModel.findById(parentTaskId).select("assignedToUserId createdBy").lean(),
      TaskModel.findOne({ _id: parsedSubtaskId, parentTaskId }),
    ]);
    if (!parent) return fail("Task not found.", 404);
    if (!subtask) return fail("Subtask not found.", 404);
    await assertCanAccessTask(actor, subtask);

    const previousStartAt = subtask.startAt ? new Date(subtask.startAt) : null;
    const previousDueAt = subtask.dueAt ? new Date(subtask.dueAt) : null;
    const nextStartAt = payload.startAt === undefined ? previousStartAt : payload.startAt;
    const nextDueAt = payload.dueAt === undefined ? previousDueAt : payload.dueAt;
    const shiftDays = diffDays(previousStartAt ?? previousDueAt, nextStartAt ?? nextDueAt);
    const impactedIds = await getSuccessorIds(parentTaskId, parsedSubtaskId);

    subtask.startAt = nextStartAt;
    subtask.dueAt = nextDueAt;
    await subtask.save();

    if (payload.shiftDependents && shiftDays !== 0 && impactedIds.length > 0) {
      const impacted = await TaskModel.find({ _id: { $in: impactedIds }, parentTaskId });
      await Promise.all(
        impacted.map(async (item) => {
          item.startAt = addDays(item.startAt ? new Date(item.startAt) : null, shiftDays);
          item.dueAt = addDays(item.dueAt ? new Date(item.dueAt) : null, shiftDays);
          await item.save();
        }),
      );
    }

    await logActivity({
      action: "workflow_node_rescheduled",
      actorId: actor.userId,
      entityType: "task",
      entityId: parentTaskId,
      details: {
        subtaskId: parsedSubtaskId,
        from: { startAt: previousStartAt, dueAt: previousDueAt },
        to: { startAt: nextStartAt, dueAt: nextDueAt },
        shiftDependents: payload.shiftDependents,
        impactedCount: payload.shiftDependents ? impactedIds.length : 0,
      },
    });
    await notifyWorkflowChanged({
      parentTaskId,
      actorId: actor.userId,
      title: `Rescheduled ${subtask.code ? `${subtask.code} ` : ""}${subtask.title}`,
      body: payload.shiftDependents
        ? `${impactedIds.length} dependent subtask(s) were shifted.`
        : "A workflow subtask was rescheduled.",
      subtaskId: parsedSubtaskId,
    });
    await syncParentTaskProgress(parentTaskId);

    const updated = await populateTaskRelations(
      TaskModel.find({ parentTaskId }).sort({ order: 1, createdAt: 1 }),
    ).lean();
    return ok(serializeForJson({ subtasks: updated, impactedIds }));
  } catch (error) {
    return handleApiError(error);
  }
}

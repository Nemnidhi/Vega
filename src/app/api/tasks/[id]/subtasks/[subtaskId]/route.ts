import { connectToDatabase } from "@/lib/db/mongodb";
import { logActivity } from "@/lib/activity/logging";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { recalculateSubtaskDependencyState, recalculateSuccessorsForPredecessor } from "@/lib/tasks/dependencies";
import { syncParentTaskProgress } from "@/lib/tasks/workflow-execution";
import {
  notifyApprovalDecision,
  notifyApprovalRequested,
  notifyAssignmentChange,
  notifyCommentMentions,
  notifyDependencyCompleted,
  notifySubtaskStateChange,
} from "@/lib/notifications/workflow";
import {
  assertCanAccessTask,
  assertCanAssignSubtask,
  getCompletionFields,
  normalizeAttachments,
  normalizeChecklist,
  normalizeComments,
  populateTaskRelations,
} from "@/lib/tasks/subtasks";
import { objectIdSchema } from "@/lib/validation/common";
import { updateAdvancedSubtaskSchema } from "@/lib/validation/task";
import { TaskDependencyModel, TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string; subtaskId: string }>;

async function getParentAndSubtask(parentTaskId: string, subtaskId: string) {
  const [parent, subtask] = await Promise.all([
    TaskModel.findById(parentTaskId).select("assignedToUserId createdBy").lean(),
    TaskModel.findOne({ _id: subtaskId, parentTaskId }),
  ]);

  return { parent, subtask };
}

export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id, subtaskId } = await params;
    const parentTaskId = objectIdSchema.parse(id);
    const parsedSubtaskId = objectIdSchema.parse(subtaskId);

    const { parent, subtask } = await getParentAndSubtask(parentTaskId, parsedSubtaskId);
    if (!parent) return fail("Task not found.", 404);
    if (!subtask) return fail("Subtask not found.", 404);
    await assertCanAccessTask(actor, subtask);

    const hydrated = await populateTaskRelations(TaskModel.findById(subtask._id)).lean();
    return ok(serializeForJson(hydrated));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id, subtaskId } = await params;
    const parentTaskId = objectIdSchema.parse(id);
    const parsedSubtaskId = objectIdSchema.parse(subtaskId);
    const payload = updateAdvancedSubtaskSchema.parse(await request.json());

    const { parent, subtask } = await getParentAndSubtask(parentTaskId, parsedSubtaskId);
    if (!parent) return fail("Task not found.", 404);
    if (!subtask) return fail("Subtask not found.", 404);
    await assertCanAccessTask(actor, subtask);
    const previousStatus = String(subtask.status);
    const previousDecision = String(subtask.workflowDecision ?? "");
    const previousNodeType = String(subtask.workflowNodeType ?? "");
    const previousAssigneeId = String(subtask.assignedToUserId ?? "");
    const previousCommentCount = subtask.comments?.length ?? 0;
    const nextStartAt = payload.startAt !== undefined ? payload.startAt : subtask.startAt;
    const nextDueAt = payload.dueAt !== undefined ? payload.dueAt : subtask.dueAt;
    if (nextStartAt && nextDueAt && new Date(nextStartAt).getTime() > new Date(nextDueAt).getTime()) {
      return fail("Due date cannot be before start date.", 422);
    }

    if (payload.assignedToUserId !== undefined) {
      assertCanAssignSubtask(actor, payload.assignedToUserId);
      if (payload.assignedToUserId) {
        subtask.assignedToUserId = payload.assignedToUserId as unknown as typeof subtask.assignedToUserId;
      }
    }

    if (payload.title !== undefined) subtask.title = payload.title;
    if (payload.description !== undefined) subtask.description = payload.description;
    if (payload.projectId !== undefined) subtask.projectId = payload.projectId as unknown as typeof subtask.projectId;
    if (payload.status !== undefined) subtask.status = payload.status;
    if (payload.priority !== undefined) subtask.priority = payload.priority;
    if (payload.startAt !== undefined) subtask.startAt = payload.startAt;
    if (payload.dueAt !== undefined) subtask.dueAt = payload.dueAt;
    if (payload.estimatedEffortHours !== undefined) subtask.estimatedEffortHours = payload.estimatedEffortHours;
    if (payload.actualEffortHours !== undefined) subtask.actualEffortHours = payload.actualEffortHours;
    if (payload.tags !== undefined) subtask.tags = payload.tags;
    if (payload.stage !== undefined) subtask.stage = payload.stage;
    if (payload.workflowNodeType !== undefined) subtask.workflowNodeType = payload.workflowNodeType;
    if (payload.workflowGroup !== undefined) subtask.workflowGroup = payload.workflowGroup;
    if (payload.workflowDecision !== undefined) subtask.workflowDecision = payload.workflowDecision;
    if (payload.attachments !== undefined) {
      subtask.attachments = normalizeAttachments(payload.attachments, actor) as typeof subtask.attachments;
    }
    if (payload.comments !== undefined) {
      subtask.comments = normalizeComments(payload.comments, actor) as typeof subtask.comments;
    }
    if (payload.checklist !== undefined) {
      subtask.checklist = normalizeChecklist(payload.checklist, actor) as typeof subtask.checklist;
    }

    if (payload.progressPercent !== undefined || payload.status !== undefined) {
      const completion = getCompletionFields(payload.status ?? String(subtask.status), payload.progressPercent);
      subtask.progressPercent = completion.progressPercent;
      subtask.completedAt = completion.completedAt;
    }

    await subtask.save();
    const recalculated =
      payload.status !== undefined || payload.workflowDecision !== undefined
        ? await recalculateSuccessorsForPredecessor(parsedSubtaskId)
        : [];
    if (payload.status !== undefined && payload.status !== previousStatus) {
      await logActivity({
        action: "workflow_node_status_changed",
        actorId: actor.userId,
        entityType: "task",
        entityId: parentTaskId,
        details: { subtaskId: parsedSubtaskId, from: previousStatus, to: payload.status },
      });
    }
    if (payload.workflowDecision !== undefined && payload.workflowDecision !== previousDecision) {
      await logActivity({
        action: "workflow_node_decision_changed",
        actorId: actor.userId,
        entityType: "task",
        entityId: parentTaskId,
        details: { subtaskId: parsedSubtaskId, from: previousDecision, to: payload.workflowDecision },
      });
    }
    await notifyAssignmentChange({
      subtask,
      parentTaskId,
      actorId: actor.userId,
      previousAssigneeId,
      nextAssigneeId: String(subtask.assignedToUserId ?? ""),
    });
    if (payload.status !== undefined && payload.status !== previousStatus) {
      await notifySubtaskStateChange({
        subtask,
        parentTaskId,
        actorId: actor.userId,
        previousStatus,
        nextStatus: String(subtask.status),
      });
      if (String(subtask.status) === "COMPLETED") {
        await notifyDependencyCompleted(subtask, actor.userId, parentTaskId);
      }
    }
    await Promise.all(
      recalculated
        .filter((item): item is NonNullable<typeof item> => {
          if (!item) return false;
          return item.changed && ["READY", "BLOCKED"].includes(item.nextStatus);
        })
        .map((item) =>
          notifySubtaskStateChange({
            subtask: item.subtask,
            parentTaskId,
            actorId: actor.userId,
            previousStatus: item.previousStatus,
            nextStatus: item.nextStatus,
          }),
        ),
    );
    if (payload.workflowDecision !== undefined && payload.workflowDecision !== previousDecision) {
      await notifyApprovalDecision({
        subtask,
        parentTaskId,
        actorId: actor.userId,
        decision: payload.workflowDecision,
      });
    }
    if (payload.workflowNodeType === "APPROVAL" && previousNodeType !== "APPROVAL") {
      await notifyApprovalRequested(subtask, actor.userId, parentTaskId);
    }
    const newComments = (subtask.comments ?? []).slice(previousCommentCount);
    await Promise.all(
      newComments.map(async (comment: { body?: string }) => {
        if (!comment.body) return;
        await logActivity({
          action: "subtask_comment_added",
          actorId: actor.userId,
          entityType: "task",
          entityId: parentTaskId,
          details: { subtaskId: parsedSubtaskId, message: `commented on ${subtask.title}` },
        });
        await notifyCommentMentions({ parentTaskId, subtask, actorId: actor.userId, body: comment.body });
      }),
    );
    await syncParentTaskProgress(parentTaskId);
    const hydrated = await populateTaskRelations(TaskModel.findById(subtask._id)).lean();
    return ok(serializeForJson(hydrated));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id, subtaskId } = await params;
    const parentTaskId = objectIdSchema.parse(id);
    const parsedSubtaskId = objectIdSchema.parse(subtaskId);

    const { parent, subtask } = await getParentAndSubtask(parentTaskId, parsedSubtaskId);
    if (!parent) return fail("Task not found.", 404);
    if (!subtask) return fail("Subtask not found.", 404);
    await assertCanAccessTask(actor, subtask);

    const predecessorEdges = await TaskDependencyModel.find({
      parentTaskId,
      predecessorSubtaskId: parsedSubtaskId,
    })
      .select("successorSubtaskId")
      .lean();
    await TaskDependencyModel.deleteMany({
      parentTaskId,
      $or: [{ predecessorSubtaskId: parsedSubtaskId }, { successorSubtaskId: parsedSubtaskId }],
    });
    await subtask.deleteOne();
    await Promise.all(predecessorEdges.map((edge) => recalculateSubtaskDependencyState(String(edge.successorSubtaskId))));
    await syncParentTaskProgress(parentTaskId);
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

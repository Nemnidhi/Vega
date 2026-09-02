import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, permissionRules } from "@/lib/auth/permissions";
import { objectIdSchema } from "@/lib/validation/common";
import { duplicateTaskSchema } from "@/lib/validation/task";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { TaskDependencyModel, TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { logActivity } from "@/lib/activity/logging";
import { generateTaskCode, generateSubtaskCode } from "@/lib/tasks/codes";

type Params = Promise<{ id: string }>;

function canAssignOthers(role: string) {
  return (permissionRules.assignTasksToOthers as string[]).includes(role);
}

function canModify(actor: { userId: string; role: string }, task: { assignedToUserId: unknown; createdBy: unknown }) {
  if (canAssignOthers(actor.role)) return true;
  return String(task.assignedToUserId) === actor.userId || String(task.createdBy) === actor.userId;
}

/** Fields carried onto the copy. Everything omitted here is deliberately reset. */
const COPIED_FIELDS = [
  "description",
  "priority",
  "assignedToUserId",
  "leadId",
  "clientId",
  "projectId",
  "kpiId",
  "startAt",
  "dueAt",
  "estimatedEffortHours",
  "tags",
  "stage",
  "order",
  "workflowPositionX",
  "workflowPositionY",
  "workflowWidth",
  "workflowCollapsed",
  "workflowGroup",
  "workflowNodeType",
  "workflowDecision",
  "workflowStages",
  "workflowTemplate",
  "checklist",
] as const;

function copyFields(source: Record<string, unknown>) {
  const copy: Record<string, unknown> = {};
  for (const field of COPIED_FIELDS) {
    if (source[field] !== undefined) copy[field] = source[field];
  }
  return copy;
}

/**
 * Duplicate a task, optionally with its children and the dependency edges between them.
 *
 * Comments, attachments, activity and import provenance are never copied - they belong to the
 * original. Checklist items are copied but reset to incomplete.
 */
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    const { id } = await params;
    const taskId = objectIdSchema.parse(id);
    const body = await request.json().catch(() => ({}));
    const payload = duplicateTaskSchema.parse(body ?? {});

    const source = await TaskModel.findById(taskId).lean();
    if (!source) {
      return fail("Task not found.", 404);
    }
    if (!canModify(actor, source as { assignedToUserId: unknown; createdBy: unknown })) {
      return fail("Forbidden", 403);
    }

    const sourceRecord = source as unknown as Record<string, unknown>;
    const isChild = Boolean(sourceRecord.parentTaskId);

    const newCode = isChild
      ? await generateSubtaskCode(String(sourceRecord.parentTaskId))
      : await generateTaskCode();

    const resetChecklist = (items: unknown) =>
      Array.isArray(items)
        ? items.map((item) => ({
            ...(item as Record<string, unknown>),
            _id: new mongoose.Types.ObjectId(),
            completed: false,
            completedAt: null,
            completedBy: null,
          }))
        : [];

    const base = copyFields(sourceRecord);

    const duplicate = await TaskModel.create({
      ...base,
      checklist: resetChecklist(sourceRecord.checklist),
      title: payload.title ?? `${String(sourceRecord.title)} (copy)`,
      code: newCode,
      status: payload.resetStatus ? "NOT_STARTED" : sourceRecord.status,
      progressPercent: payload.resetStatus ? 0 : (sourceRecord.progressPercent ?? 0),
      completedAt: null,
      actualEffortHours: null,
      archivedAt: null,
      archivedBy: null,
      parentTaskId: sourceRecord.parentTaskId ?? null,
      rootTaskId: sourceRecord.rootTaskId ?? null,
      createdBy: actor.userId,
      comments: [],
      attachments: [],
      importJobId: null,
      importExternalId: "",
      importFingerprint: "",
    });

    let childCount = 0;
    let dependencyCount = 0;

    if (payload.includeChildren) {
      const children = await TaskModel.find({ parentTaskId: taskId, archivedAt: null })
        .sort({ order: 1, createdAt: 1 })
        .lean();

      // Old child id -> new child id, so dependency edges can be rewritten onto the copies.
      const idMap = new Map<string, string>();

      for (const child of children) {
        const childRecord = child as unknown as Record<string, unknown>;
        const childCode = await generateSubtaskCode(String(duplicate._id));

        const newChild = await TaskModel.create({
          ...copyFields(childRecord),
          checklist: resetChecklist(childRecord.checklist),
          title: String(childRecord.title),
          code: childCode,
          status: payload.resetStatus ? "NOT_STARTED" : childRecord.status,
          progressPercent: payload.resetStatus ? 0 : (childRecord.progressPercent ?? 0),
          completedAt: null,
          actualEffortHours: null,
          archivedAt: null,
          archivedBy: null,
          parentTaskId: duplicate._id,
          rootTaskId: duplicate.rootTaskId ?? duplicate._id,
          createdBy: actor.userId,
          comments: [],
          attachments: [],
          importJobId: null,
          importExternalId: "",
          importFingerprint: "",
        });

        idMap.set(String(childRecord._id), String(newChild._id));
        childCount += 1;
      }

      if (payload.includeDependencies && idMap.size > 0) {
        const edges = await TaskDependencyModel.find({ parentTaskId: taskId }).lean();

        const rewritten = edges
          .map((edge) => {
            const predecessor = idMap.get(String(edge.predecessorSubtaskId));
            const successor = idMap.get(String(edge.successorSubtaskId));
            // Only edges wholly inside the duplicated set carry over; anything pointing outside
            // would silently couple the copy to the original.
            if (!predecessor || !successor) return null;
            return {
              parentTaskId: duplicate._id,
              predecessorSubtaskId: predecessor,
              successorSubtaskId: successor,
              dependencyType: edge.dependencyType,
              lagDuration: edge.lagDuration ?? null,
              branchKey: edge.branchKey ?? "",
              branchLabel: edge.branchLabel ?? "",
              createdBy: actor.userId,
            };
          })
          .filter((edge): edge is NonNullable<typeof edge> => edge !== null);

        if (rewritten.length > 0) {
          await TaskDependencyModel.insertMany(rewritten);
          dependencyCount = rewritten.length;
        }
      }
    }

    await logActivity({
      action: "task_duplicated",
      actorId: actor.userId,
      entityType: "task",
      entityId: String(duplicate._id),
      details: {
        sourceTaskId: taskId,
        sourceCode: sourceRecord.code ?? null,
        code: newCode,
        children: childCount,
        dependencies: dependencyCount,
      },
    });

    const hydrated = await TaskModel.findById(duplicate._id)
      .populate("assignedToUserId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .lean();

    return ok(
      serializeForJson({ task: hydrated, children: childCount, dependencies: dependencyCount }),
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

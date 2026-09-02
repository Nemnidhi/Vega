import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { createTaskSchema } from "@/lib/validation/task";
import { handleApiError, ok } from "@/lib/api/responses";
import { TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { logActivity } from "@/lib/activity/logging";
import { generateTaskCode, generateSubtaskCode } from "@/lib/tasks/codes";
import { getCompletionFields, normalizeTaskStatus } from "@/lib/tasks/status";
import {
  assertValidParent,
  assertValidProject,
  assertValidDateRange,
} from "@/lib/tasks/hierarchy";

function canAssignOthers(role: string) {
  return (permissionRules.assignTasksToOthers as string[]).includes(role);
}

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const requestedAssignee = searchParams.get("assignedToUserId");
    const projectId = searchParams.get("projectId");
    const includeArchived = searchParams.get("includeArchived") === "1";

    // Everyone can see their own tasks; only management roles can look at someone else's (or
    // omit the filter to see everyone's) - anything else silently narrows to "my tasks" rather
    // than erroring, since that's the safe default, not a real permission violation.
    const assignedToUserId =
      requestedAssignee && canAssignOthers(actor.role) ? requestedAssignee : actor.userId;
    const showAll = !requestedAssignee && canAssignOthers(actor.role) && searchParams.get("all") === "1";

    const query: Record<string, unknown> = { parentTaskId: null };
    if (!showAll) query.assignedToUserId = assignedToUserId;
    if (status) query.status = status;
    if (projectId) query.projectId = projectId;
    if (!includeArchived) query.archivedAt = null;

    const tasks = await TaskModel.find(query)
      .sort({ dueAt: 1, createdAt: -1 })
      .limit(500)
      .populate("assignedToUserId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .lean();

    return ok(serializeForJson(tasks));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    const payload = createTaskSchema.parse(await request.json());
    const assignedToUserId = payload.assignedToUserId ?? actor.userId;

    if (assignedToUserId !== actor.userId) {
      assertRoleAccess(actor.role, { oneOf: permissionRules.assignTasksToOthers });
    }

    const startAt = payload.startAt ?? null;
    const dueAt = payload.dueAt ?? null;
    assertValidDateRange(startAt, dueAt);
    await assertValidProject(payload.projectId);

    // A task created with a parent is a child task and takes a child code; the parent link is
    // validated server-side for loops and cross-project mismatches.
    let rootTaskId: string | null = null;
    if (payload.parentTaskId) {
      rootTaskId = await assertValidParent(null, payload.parentTaskId, {
        projectId: payload.projectId ?? null,
      });
    }

    const code = payload.parentTaskId
      ? await generateSubtaskCode(payload.parentTaskId, payload.code)
      : await generateTaskCode(payload.code);

    const status = payload.status ? normalizeTaskStatus(payload.status) : "NOT_STARTED";
    const completion = getCompletionFields(status, payload.progressPercent);

    const task = await TaskModel.create({
      title: payload.title,
      description: payload.description ?? "",
      code,
      status,
      priority: payload.priority ?? "MEDIUM",
      startAt,
      dueAt,
      estimatedEffortHours: payload.estimatedEffortHours ?? null,
      progressPercent: completion.progressPercent,
      completedAt: completion.completedAt,
      tags: payload.tags ?? [],
      stage: payload.stage ?? "",
      assignedToUserId,
      createdBy: actor.userId,
      leadId: payload.leadId ?? null,
      clientId: payload.clientId ?? null,
      projectId: payload.projectId ?? null,
      kpiId: payload.kpiId ?? null,
      parentTaskId: payload.parentTaskId ?? null,
      rootTaskId,
      // Child work is created as real Task documents through /api/tasks/[id]/subtasks, so it
      // stays visible to the workspace, the dependency engine and the workflow canvas.
    });

    await logActivity({
      action: payload.parentTaskId ? "subtask_created" : "task_created",
      actorId: actor.userId,
      entityType: "task",
      entityId: String(task._id),
      details: {
        code,
        title: payload.title,
        assignedToUserId,
        parentTaskId: payload.parentTaskId ?? null,
        projectId: payload.projectId ?? null,
      },
    });

    const hydrated = await TaskModel.findById(task._id)
      .populate("assignedToUserId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .lean();

    return ok(serializeForJson(hydrated), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

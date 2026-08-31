import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { createTaskSchema } from "@/lib/validation/task";
import { handleApiError, ok } from "@/lib/api/responses";
import { TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import type { UserRole } from "@/types/user";

function canAssignOthers(role: string) {
  return (permissionRules.assignTasksToOthers as string[]).includes(role);
}

function normalizeFlowSteps(
  steps:
    | Array<{ key: string; title: string; status?: "todo" | "in_progress" | "done"; order?: number }>
    | undefined,
) {
  return (steps ?? []).map((step, index) => ({
    key: step.key,
    title: step.title,
    status: step.status ?? "todo",
    order: step.order ?? index,
  }));
}

function normalizeSubTasks(
  subTasks:
    | Array<{
        title: string;
        description?: string;
        status?: "todo" | "in_progress" | "done";
        dueAt?: Date | null;
        assignedToUserId?: string | null;
        sourceSheet?: string;
        sourceRow?: number | null;
        order?: number;
      }>
    | undefined,
) {
  return (subTasks ?? []).map((subTask, index) => ({
    title: subTask.title,
    description: subTask.description ?? "",
    status: subTask.status ?? "todo",
    dueAt: subTask.dueAt ?? null,
    assignedToUserId: subTask.assignedToUserId ?? null,
    sourceSheet: subTask.sourceSheet ?? "",
    sourceRow: subTask.sourceRow ?? null,
    order: subTask.order ?? index,
    completedAt: subTask.status === "done" ? new Date() : null,
  }));
}

function assertSubTaskAssignees(
  actor: { userId: string; role: UserRole },
  subTasks: Array<{ assignedToUserId?: string | null }> | undefined,
) {
  if (!subTasks?.length) return;
  const assignsSomeoneElse = subTasks.some(
    (subTask) => subTask.assignedToUserId && subTask.assignedToUserId !== actor.userId,
  );
  if (assignsSomeoneElse) {
    assertRoleAccess(actor.role, { oneOf: permissionRules.assignTasksToOthers });
  }
}

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const requestedAssignee = searchParams.get("assignedToUserId");

    // Everyone can see their own tasks; only management roles can look at someone else's (or
    // omit the filter to see everyone's) - anything else silently narrows to "my tasks" rather
    // than erroring, since that's the safe default, not a real permission violation.
    const assignedToUserId =
      requestedAssignee && canAssignOthers(actor.role) ? requestedAssignee : actor.userId;
    const showAll = !requestedAssignee && canAssignOthers(actor.role) && searchParams.get("all") === "1";

    const query: Record<string, unknown> = { parentTaskId: null };
    if (!showAll) query.assignedToUserId = assignedToUserId;
    if (status) query.status = status;

    const tasks = await TaskModel.find(query)
      .sort({ dueAt: 1, createdAt: -1 })
      .limit(500)
      .populate("assignedToUserId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .populate("subTasks.assignedToUserId", "fullName email role")
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
    assertSubTaskAssignees(actor, payload.subTasks);

    const task = await TaskModel.create({
      title: payload.title,
      description: payload.description ?? "",
      dueAt: payload.dueAt ?? null,
      assignedToUserId,
      createdBy: actor.userId,
      leadId: payload.leadId ?? null,
      clientId: payload.clientId ?? null,
      projectId: payload.projectId ?? null,
      kpiId: payload.kpiId ?? null,
      workflowTemplate: payload.workflowTemplate ?? "custom",
      flowSteps: normalizeFlowSteps(payload.flowSteps),
      subTasks: normalizeSubTasks(payload.subTasks),
    });

    const hydrated = await TaskModel.findById(task._id)
      .populate("assignedToUserId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .populate("subTasks.assignedToUserId", "fullName email role")
      .lean();

    return ok(serializeForJson(hydrated), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

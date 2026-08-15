import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { createTaskSchema } from "@/lib/validation/task";
import { handleApiError, ok } from "@/lib/api/responses";
import { TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

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

    // Everyone can see their own tasks; only management roles can look at someone else's (or
    // omit the filter to see everyone's) - anything else silently narrows to "my tasks" rather
    // than erroring, since that's the safe default, not a real permission violation.
    const assignedToUserId =
      requestedAssignee && canAssignOthers(actor.role) ? requestedAssignee : actor.userId;
    const showAll = !requestedAssignee && canAssignOthers(actor.role) && searchParams.get("all") === "1";

    const query: Record<string, unknown> = {};
    if (!showAll) query.assignedToUserId = assignedToUserId;
    if (status) query.status = status;

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

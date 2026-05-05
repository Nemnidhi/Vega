import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { objectIdSchema } from "@/lib/validation/common";
import { updateProjectTaskStatusSchema } from "@/lib/validation/project";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { ProjectModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string; taskId: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.accessProjectAssignments });

    const { id, taskId } = await params;
    const projectId = objectIdSchema.parse(id);
    const parsedTaskId = objectIdSchema.parse(taskId);
    const payload = updateProjectTaskStatusSchema.parse(await request.json());

    const project = await ProjectModel.findById(projectId);
    if (!project) {
      return fail("Project not found.", 404);
    }

    const task = project.tasks.id(parsedTaskId);
    if (!task) {
      return fail("Task not found.", 404);
    }

    const assignedDeveloperId = String(task.assignedDeveloperId);
    if (actor.role === "developer") {
      if (assignedDeveloperId !== actor.userId) {
        return fail("Forbidden: this task is not assigned to you.", 403);
      }
      if (payload.status !== "done") {
        return fail("Developers can only mark assigned tasks as completed.", 403);
      }
    }

    task.status = payload.status;
    if (payload.status === "done") {
      task.completedAt = new Date();
      if (actor.role === "developer") {
        task.completedByDeveloperId = actor.userId;
        task.completionAlertPending = true;
      } else {
        task.completedByDeveloperId = null;
        task.completionAlertPending = false;
      }
    } else {
      task.completedAt = null;
      task.completedByDeveloperId = null;
      task.completionAlertPending = false;
    }

    await project.save();

    const hydrated = await ProjectModel.findById(project._id)
      .populate("assignedDeveloperId", "fullName email role status")
      .populate("createdBy", "fullName email role")
      .populate("tasks.assignedDeveloperId", "fullName email role status")
      .populate("tasks.completedByDeveloperId", "fullName email role status")
      .populate("tasks.createdBy", "fullName email role")
      .lean();

    return ok(serializeForJson(hydrated));
  } catch (error) {
    return handleApiError(error);
  }
}

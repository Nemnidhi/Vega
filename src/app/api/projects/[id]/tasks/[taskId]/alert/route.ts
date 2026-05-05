import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { objectIdSchema } from "@/lib/validation/common";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { ProjectModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string; taskId: string }>;

export async function PATCH(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageProjectAssignments });

    const { id, taskId } = await params;
    const projectId = objectIdSchema.parse(id);
    const parsedTaskId = objectIdSchema.parse(taskId);

    const project = await ProjectModel.findById(projectId);
    if (!project) {
      return fail("Project not found.", 404);
    }

    const task = project.tasks.id(parsedTaskId);
    if (!task) {
      return fail("Task not found.", 404);
    }

    task.completionAlertPending = false;
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

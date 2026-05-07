import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { createProjectTaskSchema } from "@/lib/validation/project";
import { objectIdSchema } from "@/lib/validation/common";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { ProjectModel, UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { sendTaskAssignmentEmail } from "@/lib/notifications/assignment-email";

type Params = Promise<{ id: string }>;

async function getActiveDeveloper(userId: string) {
  return UserModel.findOne({
    _id: userId,
    role: "developer",
    status: "active",
  })
    .select("_id fullName email")
    .lean();
}

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageProjectAssignments });

    const { id } = await params;
    const projectId = objectIdSchema.parse(id);
    const payload = createProjectTaskSchema.parse(await request.json());

    const developer = await getActiveDeveloper(payload.assignedDeveloperId);
    if (!developer) {
      return fail("Assigned developer not found or inactive.", 404);
    }
    const actorUser = await UserModel.findById(actor.userId).select("fullName email").lean();

    const project = await ProjectModel.findById(projectId);
    if (!project) {
      return fail("Project not found.", 404);
    }

    project.tasks.push({
      title: payload.title,
      description: payload.description ?? "",
      assignedDeveloperId: payload.assignedDeveloperId,
      status: "todo",
      createdBy: actor.userId,
      history: [
        {
          action: "assigned",
          actorId: actor.userId,
          assignedDeveloperId: payload.assignedDeveloperId,
          fromStatus: null,
          toStatus: "todo",
          note: "Task assigned by admin.",
          changedAt: new Date(),
        },
      ],
    });
    const newTask = project.tasks.at(-1);
    if (!newTask) {
      return fail("Failed to create task assignment.", 500);
    }

    if (project.status === "planned") {
      project.status = "in_progress";
    }

    await project.save();

    try {
      const emailResult = await sendTaskAssignmentEmail({
        developerEmail: developer.email,
        developerName: developer.fullName,
        assignedByName: actorUser?.fullName ?? actorUser?.email ?? "Admin",
        projectId: String(project._id),
        projectTitle: project.title,
        taskId: String(newTask._id),
        taskTitle: newTask.title,
        taskDescription: newTask.description,
        requestOrigin: new URL(request.url).origin,
        requestHeaders: request.headers,
      });
      if (!emailResult.sent) {
        console.warn("Task assignment email skipped due to missing SMTP configuration.");
      }
    } catch (notificationError) {
      console.error("Failed to send task assignment email.", notificationError);
    }

    const hydrated = await ProjectModel.findById(project._id)
      .populate("assignedDeveloperId", "fullName email role status")
      .populate("createdBy", "fullName email role")
      .populate("tasks.assignedDeveloperId", "fullName email role status")
      .populate("tasks.completedByDeveloperId", "fullName email role status")
      .populate("tasks.createdBy", "fullName email role")
      .populate("tasks.history.actorId", "fullName email role status")
      .populate("tasks.history.assignedDeveloperId", "fullName email role status")
      .lean();

    return ok(serializeForJson(hydrated));
  } catch (error) {
    return handleApiError(error);
  }
}

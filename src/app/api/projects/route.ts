import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { createProjectSchema } from "@/lib/validation/project";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { ProjectModel, UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { sendProjectAssignmentEmail } from "@/lib/notifications/assignment-email";

async function getActiveDeveloper(userId: string) {
  return UserModel.findOne({
    _id: userId,
    role: "developer",
    status: "active",
  })
    .select("_id fullName email")
    .lean();
}

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.accessProjectAssignments });

    const query =
      actor.role === "developer"
        ? {
            $or: [
              { assignedDeveloperId: actor.userId },
              { "tasks.assignedDeveloperId": actor.userId },
            ],
          }
        : {};

    const projects = await ProjectModel.find(query)
      .sort({ updatedAt: -1 })
      .populate("assignedDeveloperId", "fullName email role status")
      .populate("createdBy", "fullName email role")
      .populate("tasks.assignedDeveloperId", "fullName email role status")
      .populate("tasks.completedByDeveloperId", "fullName email role status")
      .populate("tasks.createdBy", "fullName email role")
      .populate("tasks.history.actorId", "fullName email role status")
      .populate("tasks.history.assignedDeveloperId", "fullName email role status")
      .lean();

    return ok(serializeForJson(projects));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageProjectAssignments });

    const payload = createProjectSchema.parse(await request.json());
    const developer = await getActiveDeveloper(payload.assignedDeveloperId);
    if (!developer) {
      return fail("Assigned developer not found or inactive.", 404);
    }
    const actorUser = await UserModel.findById(actor.userId).select("fullName email").lean();

    const project = await ProjectModel.create({
      title: payload.title,
      description: payload.description ?? "",
      assignedDeveloperId: payload.assignedDeveloperId,
      createdBy: actor.userId,
      status: "planned",
      tasks: [],
    });

    try {
      const emailResult = await sendProjectAssignmentEmail({
        developerEmail: developer.email,
        developerName: developer.fullName,
        assignedByName: actorUser?.fullName ?? actorUser?.email ?? "Admin",
        projectId: String(project._id),
        projectTitle: project.title,
        projectDescription: project.description,
        requestOrigin: new URL(request.url).origin,
        requestHeaders: request.headers,
      });
      if (!emailResult.sent) {
        console.warn("Project assignment email skipped due to missing SMTP configuration.");
      }
    } catch (notificationError) {
      console.error("Failed to send project assignment email.", notificationError);
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

    return ok(serializeForJson(hydrated), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

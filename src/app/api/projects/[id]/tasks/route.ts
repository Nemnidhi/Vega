import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { createProjectTaskSchema } from "@/lib/validation/project";
import { objectIdSchema } from "@/lib/validation/common";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { ProjectModel, UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

async function ensureDeveloperExists(userId: string) {
  const developer = await UserModel.findOne({
    _id: userId,
    role: "developer",
    status: "active",
  })
    .select("_id")
    .lean();

  return Boolean(developer);
}

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageProjectAssignments });

    const { id } = await params;
    const projectId = objectIdSchema.parse(id);
    const payload = createProjectTaskSchema.parse(await request.json());

    const hasDeveloper = await ensureDeveloperExists(payload.assignedDeveloperId);
    if (!hasDeveloper) {
      return fail("Assigned developer not found or inactive.", 404);
    }

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
    });

    if (project.status === "planned") {
      project.status = "in_progress";
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

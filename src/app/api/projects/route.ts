import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { createProjectSchema } from "@/lib/validation/project";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { ProjectModel, UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

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
    const hasDeveloper = await ensureDeveloperExists(payload.assignedDeveloperId);
    if (!hasDeveloper) {
      return fail("Assigned developer not found or inactive.", 404);
    }

    const project = await ProjectModel.create({
      title: payload.title,
      description: payload.description ?? "",
      assignedDeveloperId: payload.assignedDeveloperId,
      createdBy: actor.userId,
      status: "planned",
      tasks: [],
    });

    const hydrated = await ProjectModel.findById(project._id)
      .populate("assignedDeveloperId", "fullName email role status")
      .populate("createdBy", "fullName email role")
      .populate("tasks.assignedDeveloperId", "fullName email role status")
      .populate("tasks.completedByDeveloperId", "fullName email role status")
      .populate("tasks.createdBy", "fullName email role")
      .lean();

    return ok(serializeForJson(hydrated), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

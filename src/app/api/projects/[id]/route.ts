import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { objectIdSchema } from "@/lib/validation/common";
import { updateProjectStatusSchema } from "@/lib/validation/project";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { ProjectModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

type ProjectPopulationQuery<TSelf> = {
  populate(path: string, select: string): TSelf;
};

function applyProjectPopulation<T extends ProjectPopulationQuery<T>>(
  query: T,
  includeHistory: boolean,
) {
  let populated = query
    .populate("assignedDeveloperId", "fullName email role status")
    .populate("createdBy", "fullName email role")
    .populate("tasks.assignedDeveloperId", "fullName email role status")
    .populate("tasks.completedByDeveloperId", "fullName email role status")
    .populate("tasks.createdBy", "fullName email role");

  if (includeHistory) {
    populated = populated
      .populate("tasks.history.actorId", "fullName email role status")
      .populate("tasks.history.assignedDeveloperId", "fullName email role status");
  }

  return populated;
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.accessProjectAssignments });

    const { id } = await params;
    const projectId = objectIdSchema.parse(id);
    const includeHistory = request.nextUrl.searchParams.get("includeHistory") !== "0";

    const query =
      actor.role === "developer"
        ? {
            _id: projectId,
            $or: [
              { assignedDeveloperId: actor.userId },
              { "tasks.assignedDeveloperId": actor.userId },
            ],
          }
        : { _id: projectId };

    const project = await applyProjectPopulation(
      ProjectModel.findOne(query),
      includeHistory,
    ).lean();
    if (!project) {
      return fail("Project not found.", 404);
    }

    return ok(serializeForJson(project));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageProjectAssignments });

    const { id } = await params;
    const projectId = objectIdSchema.parse(id);
    const payload = updateProjectStatusSchema.parse(await request.json());

    const project = await ProjectModel.findById(projectId);
    if (!project) {
      return fail("Project not found.", 404);
    }

    project.status = payload.status;
    await project.save();

    const hydrated = await applyProjectPopulation(
      ProjectModel.findById(project._id),
      true,
    ).lean();

    return ok(serializeForJson(hydrated));
  } catch (error) {
    return handleApiError(error);
  }
}

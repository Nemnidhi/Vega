import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { createProjectSchema, listProjectsQuerySchema } from "@/lib/validation/project";
import { handleApiError, ok } from "@/lib/api/responses";
import { ProjectModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { logActivity } from "@/lib/activity/logging";

function canManageProjects(role: string) {
  return (permissionRules.assignTasksToOthers as string[]).includes(role);
}

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    const { searchParams } = new URL(request.url);
    const filters = listProjectsQuerySchema.parse({
      status: searchParams.get("status") ?? undefined,
      clientId: searchParams.get("clientId") ?? undefined,
      includeArchived: searchParams.get("includeArchived") ?? undefined,
    });

    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.clientId) query.clientId = filters.clientId;
    if (!filters.includeArchived) query.archivedAt = null;

    // Managers see every project; everyone else sees only the ones they run or are on the team of.
    if (!canManageProjects(actor.role)) {
      query.$or = [
        { projectManagerId: actor.userId },
        { "team.userId": actor.userId },
        { createdBy: actor.userId },
      ];
    }

    const projects = await ProjectModel.find(query)
      .sort({ updatedAt: -1 })
      .limit(500)
      .populate("clientId", "legalName primaryContactName primaryContactEmail")
      .populate("projectManagerId", "fullName email role")
      .populate("createdBy", "fullName email role")
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

    assertRoleAccess(actor.role, { oneOf: permissionRules.assignTasksToOthers });

    const payload = createProjectSchema.parse(await request.json());

    const project = await ProjectModel.create({
      ...payload,
      team: payload.team.map((member) => ({ ...member, addedAt: new Date() })),
      createdBy: actor.userId,
    });

    await logActivity({
      action: "project_created",
      actorId: actor.userId,
      entityType: "project",
      entityId: String(project._id),
      details: { title: payload.title, status: payload.status, clientId: payload.clientId ?? null },
    });

    const hydrated = await ProjectModel.findById(project._id)
      .populate("clientId", "legalName primaryContactName primaryContactEmail")
      .populate("projectManagerId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .lean();

    return ok(serializeForJson(hydrated), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

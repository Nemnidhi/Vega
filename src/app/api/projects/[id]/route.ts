import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { objectIdSchema } from "@/lib/validation/common";
import { updateProjectSchema } from "@/lib/validation/project";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { ProjectModel, TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { logActivity } from "@/lib/activity/logging";

type Params = Promise<{ id: string }>;

function canManageProjects(role: string) {
  return (permissionRules.assignTasksToOthers as string[]).includes(role);
}

function canViewProject(
  actor: { userId: string; role: string },
  project: { projectManagerId?: unknown; createdBy?: unknown; team?: Array<{ userId?: unknown }> },
) {
  if (canManageProjects(actor.role)) return true;
  if (String(project.projectManagerId ?? "") === actor.userId) return true;
  if (String(project.createdBy ?? "") === actor.userId) return true;
  return (project.team ?? []).some((member) => String(member.userId ?? "") === actor.userId);
}

export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    const { id } = await params;
    const projectId = objectIdSchema.parse(id);

    const project = await ProjectModel.findById(projectId)
      .populate("clientId", "legalName primaryContactName primaryContactEmail")
      .populate("projectManagerId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .populate("team.userId", "fullName email role")
      .lean();

    if (!project) {
      return fail("Project not found.", 404);
    }
    if (!canViewProject(actor, project as Parameters<typeof canViewProject>[1])) {
      return fail("Forbidden", 403);
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

    assertRoleAccess(actor.role, { oneOf: permissionRules.assignTasksToOthers });

    const { id } = await params;
    const projectId = objectIdSchema.parse(id);
    const payload = updateProjectSchema.parse(await request.json());

    const project = await ProjectModel.findById(projectId);
    if (!project) {
      return fail("Project not found.", 404);
    }

    const previousStatus = project.status;

    Object.assign(project, payload);
    if (payload.team) {
      project.team = payload.team.map((member) => ({
        ...member,
        addedAt: new Date(),
      })) as typeof project.team;
    }
    if (payload.status === "completed" && previousStatus !== "completed") {
      project.completedAt = new Date();
    }

    await project.save();

    await logActivity({
      action: "project_updated",
      actorId: actor.userId,
      entityType: "project",
      entityId: projectId,
      details: { fields: Object.keys(payload), from: previousStatus, to: project.status },
    });

    const hydrated = await ProjectModel.findById(projectId)
      .populate("clientId", "legalName primaryContactName primaryContactEmail")
      .populate("projectManagerId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .lean();

    return ok(serializeForJson(hydrated));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Archive only - projects are never hard-deleted.
 *
 * Tasks pointing at the project keep their `projectId`; archiving the container must not orphan
 * or silently destroy delivery history.
 */
export async function DELETE(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    assertRoleAccess(actor.role, { oneOf: permissionRules.assignTasksToOthers });

    const { id } = await params;
    const projectId = objectIdSchema.parse(id);

    const project = await ProjectModel.findById(projectId);
    if (!project) {
      return fail("Project not found.", 404);
    }

    const openTasks = await TaskModel.countDocuments({
      projectId,
      archivedAt: null,
      status: { $nin: ["COMPLETED", "CANCELLED", "done"] },
    });

    project.archivedAt = new Date();
    await project.save();

    await logActivity({
      action: "project_archived",
      actorId: actor.userId,
      entityType: "project",
      entityId: projectId,
      details: { title: project.title, openTasksAtArchive: openTasks },
    });

    return ok({ archived: true, openTasksAtArchive: openTasks });
  } catch (error) {
    return handleApiError(error);
  }
}

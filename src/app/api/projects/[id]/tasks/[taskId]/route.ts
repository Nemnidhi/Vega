import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { objectIdSchema } from "@/lib/validation/common";
import { updateProjectTaskStatusSchema } from "@/lib/validation/project";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { sendTaskCompletionAlertEmailToAdmin } from "@/lib/notifications/assignment-email";
import { ProjectModel, UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string; taskId: string }>;

function parseConfiguredAdminAlertEmails() {
  const raw = process.env.ADMIN_TASK_COMPLETION_ALERT_EMAILS;
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

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

    const previousStatus = task.status;
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

    if (!Array.isArray(task.history)) {
      task.history = [];
    }

    if (previousStatus !== payload.status) {
      task.history.push({
        action: "status_changed",
        actorId: actor.userId,
        assignedDeveloperId: task.assignedDeveloperId,
        fromStatus: previousStatus,
        toStatus: payload.status,
        note:
          actor.role === "developer"
            ? "Task marked as completed by assigned developer."
            : "Task status updated by admin.",
        changedAt: new Date(),
      });
    }

    const shouldNotifyAdminByEmail =
      actor.role === "developer" && previousStatus !== "done" && payload.status === "done";

    await project.save();

    if (shouldNotifyAdminByEmail) {
      try {
        const [actorUser, adminUsers, projectCreatorUser] = await Promise.all([
          UserModel.findById(actor.userId).select("fullName email").lean(),
          UserModel.find({
            role: "admin",
          })
            .select("fullName email")
            .lean(),
          UserModel.findById(project.createdBy).select("fullName email role").lean(),
        ]);

        const recipients = new Map<string, { email: string; fullName?: string }>();
        for (const adminUser of adminUsers) {
          const normalizedEmail = adminUser.email?.trim().toLowerCase();
          if (!normalizedEmail) {
            continue;
          }
          recipients.set(normalizedEmail, {
            email: normalizedEmail,
            fullName: adminUser.fullName ?? undefined,
          });
        }

        const projectCreatorEmail = projectCreatorUser?.email?.trim().toLowerCase();
        if (projectCreatorEmail) {
          recipients.set(projectCreatorEmail, {
            email: projectCreatorEmail,
            fullName: projectCreatorUser?.fullName ?? undefined,
          });
        }

        for (const configuredEmail of parseConfiguredAdminAlertEmails()) {
          if (!recipients.has(configuredEmail)) {
            recipients.set(configuredEmail, {
              email: configuredEmail,
            });
          }
        }

        if (recipients.size > 0) {
          const totalTasks = project.tasks.length;
          let completedTasks = 0;
          for (const projectTask of project.tasks) {
            if (projectTask.status === "done") {
              completedTasks += 1;
            }
          }
          const allProjectTasksCompleted =
            totalTasks > 0 && completedTasks === totalTasks;
          const completionRate =
            totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
          const completedByName =
            actorUser?.fullName?.trim() || actorUser?.email?.trim() || "Developer";
          const recipientList = [...recipients.values()];

          const results = await Promise.allSettled(
            recipientList.map((recipient) =>
              sendTaskCompletionAlertEmailToAdmin({
                adminEmail: recipient.email,
                adminName: recipient.fullName,
                developerName: completedByName,
                projectId: String(project._id),
                projectTitle: project.title,
                taskId: String(task._id),
                taskTitle: task.title,
                taskDescription: task.description,
                completedAt: task.completedAt,
                allProjectTasksCompleted,
                completionRate,
                requestOrigin: new URL(request.url).origin,
                requestHeaders: request.headers,
              }),
            ),
          );

          const failedEmails = results.filter(
            (result) => result.status === "rejected",
          ).length;
          if (failedEmails > 0) {
            console.error(
              `Failed to send ${failedEmails} admin completion alert email(s).`,
            );
          }

          const successfulEmails = results.filter(
            (result) =>
              result.status === "fulfilled" && result.value.sent === true,
          ).length;
          if (successfulEmails > 0) {
            console.log(
              `Sent ${successfulEmails} admin completion alert email(s) for task ${String(task._id)}.`,
            );
          }

          const skippedEmails = results.filter(
            (result) =>
              result.status === "fulfilled" && result.value.sent === false,
          ).length;
          if (skippedEmails > 0) {
            console.warn(
              "Task completion alert email skipped due to missing SMTP configuration.",
            );
          }
        } else {
          console.warn(
            "No admin completion alert recipients found for developer task completion.",
          );
        }
      } catch (notificationError) {
        console.error("Failed to send admin completion alert email.", notificationError);
      }
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

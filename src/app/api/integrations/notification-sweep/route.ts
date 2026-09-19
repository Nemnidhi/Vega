import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidDashboardSecret } from "@/lib/auth/dashboard-actor";
import { handleApiError, ok } from "@/lib/api/responses";
import { runWorkflowDueNotificationSweep } from "@/lib/notifications/workflow";
import { sweepOverdueTasks } from "@/lib/notifications/tasks";
import { sweepOverdueFollowUps } from "@/lib/notifications/follow-ups";

/**
 * Time-based notifications: overdue tasks, overdue follow-ups, and subtasks
 * approaching their due date.
 *
 * These cannot be raised by a request from the person they concern - nobody
 * opens the app to be told their task is late - so a scheduled caller drives
 * them. Authenticated by the shared integration secret rather than a session,
 * because a cron has no user.
 *
 * Safe to run as often as you like: every notification here is keyed to the day,
 * so re-running only re-raises something that is still outstanding, and the
 * dispatcher pushes only on a genuine insert.
 */
export async function POST(request: Request) {
  try {
    assertValidDashboardSecret(request);
    await connectToDatabase();

    const [workflow, overdueTasks, overdueFollowUps] = await Promise.all([
      runWorkflowDueNotificationSweep(2),
      sweepOverdueTasks(),
      sweepOverdueFollowUps(),
    ]);

    return ok({
      subtasksDueSoon: workflow.dueDateApproaching,
      subtasksOverdue: workflow.overdue,
      tasksOverdue: overdueTasks,
      followUpsOverdue: overdueFollowUps,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

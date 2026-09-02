import { connectToDatabase } from "@/lib/db/mongodb";
import { KpiModel, TaskDependencyModel, TaskModel, UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { computeKpiProgressBulk } from "@/lib/kpi/progress";
import { permissionRules } from "@/lib/auth/permissions";
import { getDependencyMap } from "@/lib/tasks/dependencies";
import { canAccessTask, populateTaskRelations } from "@/lib/tasks/subtasks";
import type { UserRole } from "@/types/user";

function canAssignOthers(role: UserRole) {
  return (permissionRules.assignTasksToOthers as UserRole[]).includes(role);
}

function canManageKpis(role: UserRole) {
  return (permissionRules.manageKpis as UserRole[]).includes(role);
}

export async function getTasksForUser(userId: string) {
  await connectToDatabase();
  const tasks = await TaskModel.find({ assignedToUserId: userId, parentTaskId: null })
    .sort({ dueAt: 1, createdAt: -1 })
    .limit(500)
    .populate("assignedToUserId", "fullName email role")
    .populate("createdBy", "fullName email role")
    .populate("subTasks.assignedToUserId", "fullName email role")
    .lean();
  return serializeForJson(tasks);
}

export async function getKpisForUser(userId: string, role: UserRole) {
  await connectToDatabase();
  const query = canManageKpis(role)
    ? {}
    : { $or: [{ assignedUserId: userId }, { assignedRole: role }] };

  const kpis = await KpiModel.find(query)
    .sort({ periodStart: -1 })
    .populate("assignedUserId", "fullName email role")
    .lean();

  const progressByKpiId = await computeKpiProgressBulk(kpis.map((kpi) => String(kpi._id)));
  const withProgress = kpis.map((kpi) => {
    const completed = progressByKpiId.get(String(kpi._id)) ?? 0;
    return {
      ...kpi,
      progress: {
        completed,
        target: kpi.target,
        progress: kpi.target > 0 ? Math.min(1, completed / kpi.target) : 0,
      },
    };
  });

  return serializeForJson(withProgress);
}

export async function getAssignableUsers(role: UserRole) {
  if (!canAssignOthers(role)) return [];
  await connectToDatabase();
  const users = await UserModel.find({ status: "active" })
    .select("fullName email role")
    .sort({ fullName: 1 })
    .lean();
  return serializeForJson(users);
}

export async function getTaskDetailForUser(taskId: string, userId: string, role: UserRole) {
  await connectToDatabase();
  const task = await populateTaskRelations(
    TaskModel.findOne({ _id: taskId, parentTaskId: null })
      .populate("subTasks.assignedToUserId", "fullName email role")
      .populate("leadId", "title status")
      .populate("projectId", "title status code")
      .populate("clientId", "businessName contactName email"),
  ).lean();

  if (!task || !canAccessTask({ userId, role }, task)) {
    return null;
  }

  const subtasks = await populateTaskRelations(
    TaskModel.find({ parentTaskId: taskId }).sort({ order: 1, createdAt: 1 }),
  ).lean();
  const dependencyMap = await getDependencyMap(taskId);
  const subtasksWithDependencies = subtasks.map((subtask) => ({
    ...subtask,
    blockedBy: dependencyMap.bySuccessor.get(String(subtask._id)) ?? [],
    blocking: dependencyMap.byPredecessor.get(String(subtask._id)) ?? [],
  }));

  return serializeForJson({ task, subtasks: subtasksWithDependencies, dependencies: dependencyMap.dependencies });
}

/**
 * Root tasks for the Tasks workspace, with the counts the table and KPI strip need.
 *
 * Wider than getTasksForUser, which only returns work assigned to the caller and so cannot back
 * the "All Tasks" / "Assigned by Me" / "Blocked" views. Visibility still follows the same rule as
 * the task routes: roles that can assign work see everything, everyone else sees what they are
 * assigned or created.
 *
 * Child counts and dependency counts are gathered with two grouped aggregations rather than a
 * per-row query, so the page cost stays flat as the task list grows.
 */
export async function getTasksWorkspace(userId: string, role: UserRole) {
  await connectToDatabase();

  const query: Record<string, unknown> = { parentTaskId: null, archivedAt: null };
  if (!canAssignOthers(role)) {
    query.$or = [{ assignedToUserId: userId }, { createdBy: userId }];
  }

  const tasks = await TaskModel.find(query)
    .sort({ dueAt: 1, createdAt: -1 })
    .limit(500)
    .select(
      "title description code status priority dueAt startAt completedAt progressPercent stage tags " +
        "assignedToUserId createdBy projectId clientId leadId kpiId createdAt updatedAt",
    )
    .populate("assignedToUserId", "fullName email role")
    .populate("createdBy", "fullName email role")
    .populate("projectId", "title status code")
    .lean();

  const taskIds = tasks.map((task) => task._id);
  if (taskIds.length === 0) {
    return serializeForJson([]);
  }

  const [childGroups, dependencyGroups] = await Promise.all([
    TaskModel.aggregate<{ _id: unknown; total: number; completed: number }>([
      { $match: { parentTaskId: { $in: taskIds }, archivedAt: null } },
      {
        $group: {
          _id: "$parentTaskId",
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $in: ["$status", ["COMPLETED", "done"]] }, 1, 0] },
          },
        },
      },
    ]),
    TaskDependencyModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { parentTaskId: { $in: taskIds } } },
      { $group: { _id: "$parentTaskId", count: { $sum: 1 } } },
    ]),
  ]);

  const childrenById = new Map(childGroups.map((group) => [String(group._id), group]));
  const dependenciesById = new Map(dependencyGroups.map((group) => [String(group._id), group.count]));

  const withCounts = tasks.map((task) => {
    const children = childrenById.get(String(task._id));
    return {
      ...task,
      subtaskCount: children?.total ?? 0,
      subtaskCompletedCount: children?.completed ?? 0,
      dependencyCount: dependenciesById.get(String(task._id)) ?? 0,
    };
  });

  return serializeForJson(withCounts);
}

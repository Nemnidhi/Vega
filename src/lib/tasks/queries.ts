import { connectToDatabase } from "@/lib/db/mongodb";
import { KpiModel, TaskModel, UserModel } from "@/models";
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

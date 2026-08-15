import { connectToDatabase } from "@/lib/db/mongodb";
import { KpiModel, TaskModel, UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { computeKpiProgressBulk } from "@/lib/kpi/progress";
import { permissionRules } from "@/lib/auth/permissions";
import type { UserRole } from "@/types/user";

function canAssignOthers(role: UserRole) {
  return (permissionRules.assignTasksToOthers as UserRole[]).includes(role);
}

function canManageKpis(role: UserRole) {
  return (permissionRules.manageKpis as UserRole[]).includes(role);
}

export async function getTasksForUser(userId: string) {
  await connectToDatabase();
  const tasks = await TaskModel.find({ assignedToUserId: userId })
    .sort({ dueAt: 1, createdAt: -1 })
    .limit(500)
    .populate("assignedToUserId", "fullName email role")
    .populate("createdBy", "fullName email role")
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

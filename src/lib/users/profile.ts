import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { LOGIN_ROLES } from "@/lib/auth/constants";
import { computeKpiProgressBulk } from "@/lib/kpi/progress";
import { normalizeTaskStatus } from "@/lib/tasks/status";
import { serializeForJson } from "@/lib/utils/serialize";
import {
  ActivityLogModel,
  AttendanceModel,
  KpiModel,
  LeaveRequestModel,
  TaskModel,
  UserModel,
} from "@/models";

export type UserProfileTask = {
  id: string;
  title: string;
  status: string;
  dueAt?: string | null;
  priority: string;
  overdue: boolean;
};

export type UserProfileTarget = {
  id: string;
  title: string;
  target: number;
  completed: number;
  progressPercent: number;
};

export type UserProfileActivity = {
  id: string;
  action: string;
  entityType: string;
  createdAt?: string | null;
};

export type UserProfilePayload = {
  monthKey: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    status: "active" | "inactive" | "invited";
    phone: string;
    department: string;
    avatarUrl: string;
    employeeId: string;
    manager: { id: string; fullName: string } | null;
  };
  managers: Array<{ id: string; fullName: string }>;
  attendance: {
    present: number;
    late: number;
    absent: number;
    halfDay: number;
    leave: number;
    totalMarked: number;
    attendancePercent: number;
  };
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    todo: number;
    overdue: number;
    completionPercent: number;
    items: UserProfileTask[];
  };
  targets: {
    total: number;
    met: number;
    progressPercent: number;
    items: UserProfileTarget[];
  };
  activity: UserProfileActivity[];
};

export async function getUserProfile(userId: string, monthKey: string) {
  if (!Types.ObjectId.isValid(userId) || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  await connectToDatabase();

  const user = await UserModel.findOne({ _id: userId, role: { $in: LOGIN_ROLES } })
    .select("fullName email role status phone department avatarUrl managerId")
    .populate("managerId", "fullName")
    .lean();
  if (!user) return null;

  const monthStart = new Date(`${monthKey}-01T00:00:00.000Z`);
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  const [attendanceEntries, leaveRequests, tasks, kpis, managers] = await Promise.all([
    AttendanceModel.find({ userId, dateKey: { $regex: `^${monthKey}` } })
      .select("dateKey dayStatus")
      .lean(),
    LeaveRequestModel.find({
      userId,
      status: "approved",
      startDateKey: { $lte: `${monthKey}-31` },
      endDateKey: { $gte: `${monthKey}-01` },
    }).select("totalDays").lean(),
    TaskModel.find({ assignedToUserId: userId, parentTaskId: null, archivedAt: null })
      .sort({ dueAt: 1, updatedAt: -1 })
      .limit(100)
      .select("title status dueAt priority updatedAt")
      .lean(),
    KpiModel.find({
      $or: [{ assignedUserId: userId }, { assignedRole: user.role }],
      periodStart: { $lt: monthEnd },
      periodEnd: { $gte: monthStart },
    }).sort({ periodStart: -1 }).select("title target periodStart periodEnd").lean(),
    UserModel.find({ role: { $in: LOGIN_ROLES }, status: "active", _id: { $ne: userId } })
      .sort({ fullName: 1 })
      .select("fullName")
      .lean(),
  ]);

  const taskIds = tasks.map((task) => task._id);
  const [progressByKpi, activityLogs] = await Promise.all([
    computeKpiProgressBulk(kpis.map((kpi) => String(kpi._id))),
    ActivityLogModel.find({
      $or: [
        { actorId: userId },
        ...(taskIds.length > 0 ? [{ entityType: "task", entityId: { $in: taskIds } }] : []),
      ],
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("action entityType createdAt")
      .lean(),
  ]);

  const attendance = attendanceEntries.reduce(
    (summary, entry) => {
      if (entry.dayStatus === "present") summary.present += 1;
      if (entry.dayStatus === "late_coming") summary.late += 1;
      if (entry.dayStatus === "absent") summary.absent += 1;
      if (entry.dayStatus === "half_day") summary.halfDay += 1;
      summary.totalMarked += 1;
      return summary;
    },
    { present: 0, late: 0, absent: 0, halfDay: 0, leave: 0, totalMarked: 0 },
  );
  attendance.leave = leaveRequests.reduce((total, request) => total + (request.totalDays ?? 0), 0);
  const attendanceDenominator = attendance.totalMarked + attendance.leave;
  const attendancePercent = attendanceDenominator > 0
    ? Math.round(((attendance.present + attendance.late + attendance.halfDay * 0.5) / attendanceDenominator) * 100)
    : 0;

  const now = new Date();
  const taskItems = tasks.map((task) => {
    const status = normalizeTaskStatus(task.status);
    const closed = status === "COMPLETED" || status === "CANCELLED";
    return {
      id: String(task._id),
      title: task.title,
      status,
      dueAt: task.dueAt ?? null,
      priority: task.priority,
      overdue: Boolean(task.dueAt && !closed && new Date(task.dueAt) < now),
    };
  });
  const completedTasks = taskItems.filter((task) => task.status === "COMPLETED").length;
  const inProgressTasks = taskItems.filter((task) => ["IN_PROGRESS", "REVIEW", "CLIENT_REVIEW", "WAITING", "BLOCKED"].includes(task.status)).length;
  const todoTasks = taskItems.filter((task) => ["NOT_STARTED", "READY"].includes(task.status)).length;
  const overdueTasks = taskItems.filter((task) => task.overdue).length;

  const targetItems = kpis.map((kpi) => {
    const completed = progressByKpi.get(String(kpi._id)) ?? 0;
    return {
      id: String(kpi._id),
      title: kpi.title,
      target: kpi.target,
      completed,
      progressPercent: Math.min(100, Math.round((completed / Math.max(1, kpi.target)) * 100)),
    };
  });
  const totalTargetValue = targetItems.reduce((total, target) => total + target.target, 0);
  const totalTargetProgress = targetItems.reduce((total, target) => total + Math.min(target.completed, target.target), 0);

  const populatedManager = user.managerId && typeof user.managerId === "object" && "fullName" in user.managerId
    ? user.managerId as unknown as { _id: Types.ObjectId; fullName: string }
    : null;

  return serializeForJson({
    monthKey,
    user: {
      id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      phone: user.phone ?? "",
      department: user.department ?? "",
      avatarUrl: user.avatarUrl ?? "",
      employeeId: `VG-${String(user._id).slice(-4).toUpperCase()}`,
      manager: populatedManager ? { id: String(populatedManager._id), fullName: populatedManager.fullName } : null,
    },
    managers: managers.map((manager) => ({ id: String(manager._id), fullName: manager.fullName })),
    attendance: { ...attendance, attendancePercent },
    tasks: {
      total: taskItems.length,
      completed: completedTasks,
      inProgress: inProgressTasks,
      todo: todoTasks,
      overdue: overdueTasks,
      completionPercent: taskItems.length > 0 ? Math.round((completedTasks / taskItems.length) * 100) : 0,
      items: taskItems.slice(0, 5),
    },
    targets: {
      total: targetItems.length,
      met: targetItems.filter((target) => target.completed >= target.target).length,
      progressPercent: totalTargetValue > 0 ? Math.round((totalTargetProgress / totalTargetValue) * 100) : 0,
      items: targetItems.slice(0, 4),
    },
    activity: activityLogs.map((log) => ({
      id: String(log._id),
      action: log.action,
      entityType: log.entityType,
      createdAt: log.createdAt ?? null,
    })),
  }) as UserProfilePayload;
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { permissionRules } from "@/lib/auth/permissions";
import { TaskDependencyModel, TaskModel, UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import type { TaskActor } from "@/lib/tasks/subtasks";
import type { UserRole } from "@/types/user";

type AnalyticsFilters = {
  projectId?: string;
  userId?: string;
  status?: string;
  priority?: string;
  startDate?: Date;
  endDate?: Date;
  stage?: string;
};

type UserShape = {
  _id: unknown;
  fullName: string;
  email: string;
  role?: UserRole;
  status?: string;
};

type TaskShape = {
  _id: unknown;
  title: string;
  status: string;
  priority?: string;
  assignedToUserId?: UserShape | string | null;
  createdBy?: unknown;
  projectId?: unknown;
  parentTaskId?: unknown;
  startAt?: Date | string | null;
  dueAt?: Date | string | null;
  completedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  estimatedEffortHours?: number | null;
  stage?: string;
  workflowGroup?: string;
  subTasks?: EmbeddedSubtaskShape[];
};

type EmbeddedSubtaskShape = {
  _id?: unknown;
  title: string;
  status?: string;
  dueAt?: Date | string | null;
  assignedToUserId?: UserShape | string | null;
  completedAt?: Date | string | null;
  createdAt?: Date | string | null;
  sourceSheet?: string;
};

type DependencyForAnalytics = {
  parentTaskId?: unknown;
  predecessorSubtaskId: unknown;
  successorSubtaskId: unknown;
};

type WorkItem = {
  id: string;
  type: "task" | "subtask" | "embedded_subtask";
  title: string;
  status: string;
  priority: string;
  assignedToUserId: string;
  assignedToName: string;
  assignedToRole: string;
  projectId: string;
  stage: string;
  startAt: Date | null;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  estimatedEffortHours: number;
};

const MANAGER_ROLES = permissionRules.assignTasksToOthers as UserRole[];
const ACTIVE_STATUSES = new Set(["in_progress", "IN_PROGRESS", "READY", "REVIEW", "WAITING"]);
const COMPLETE_STATUSES = new Set(["done", "COMPLETED"]);
const CLOSED_STATUSES = new Set(["done", "COMPLETED", "CANCELLED"]);

function canViewTeamAnalytics(role: UserRole) {
  return MANAGER_ROLES.includes(role);
}

function id(value: unknown) {
  return String((value as { _id?: unknown })?._id ?? value ?? "");
}

function toDate(value?: Date | string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function weekKey(value: Date) {
  const date = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

function businessDaysBetween(from?: Date, to?: Date) {
  const start = from ? new Date(from) : new Date();
  const end = to ? new Date(to) : new Date(start.getTime() + 6 * 86_400_000);
  let days = 0;
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days += 1;
  }
  return Math.max(days, 1);
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function userInfo(value: UserShape | string | null | undefined) {
  if (!value) return { id: "", name: "Unassigned", role: "unassigned" };
  if (typeof value === "string") return { id: value, name: value, role: "unknown" };
  return {
    id: id(value._id),
    name: value.fullName || value.email,
    role: value.role ?? "unknown",
  };
}

function normalizeTask(task: TaskShape, type: "task" | "subtask"): WorkItem {
  const assignee = userInfo(task.assignedToUserId);
  return {
    id: id(task._id),
    type,
    title: task.title,
    status: task.status,
    priority: task.priority ?? "MEDIUM",
    assignedToUserId: assignee.id,
    assignedToName: assignee.name,
    assignedToRole: assignee.role,
    projectId: id(task.projectId),
    stage: task.workflowGroup || task.stage || "",
    startAt: toDate(task.startAt),
    dueAt: toDate(task.dueAt),
    completedAt: toDate(task.completedAt),
    createdAt: toDate(task.createdAt),
    updatedAt: toDate(task.updatedAt),
    estimatedEffortHours: Number(task.estimatedEffortHours ?? 0),
  };
}

function normalizeEmbeddedSubtask(parent: TaskShape, subtask: EmbeddedSubtaskShape): WorkItem {
  const assignee = userInfo(subtask.assignedToUserId ?? parent.assignedToUserId);
  return {
    id: id(subtask._id) || `${id(parent._id)}:${subtask.title}`,
    type: "embedded_subtask",
    title: subtask.title,
    status: subtask.status ?? "todo",
    priority: parent.priority ?? "MEDIUM",
    assignedToUserId: assignee.id,
    assignedToName: assignee.name,
    assignedToRole: assignee.role,
    projectId: id(parent.projectId),
    stage: subtask.sourceSheet ?? "",
    startAt: null,
    dueAt: toDate(subtask.dueAt),
    completedAt: toDate(subtask.completedAt),
    createdAt: toDate(subtask.createdAt ?? parent.createdAt),
    updatedAt: toDate(parent.updatedAt),
    estimatedEffortHours: 0,
  };
}

function matchesDateRange(item: WorkItem, filters: AnalyticsFilters) {
  if (!filters.startDate && !filters.endDate) return true;
  const from = filters.startDate?.getTime() ?? Number.NEGATIVE_INFINITY;
  const to = filters.endDate ? new Date(filters.endDate).setHours(23, 59, 59, 999) : Number.POSITIVE_INFINITY;
  return [item.startAt, item.dueAt, item.completedAt, item.createdAt, item.updatedAt].some((date) => {
    const time = date?.getTime();
    return time !== undefined && time >= from && time <= to;
  });
}

function matchesFilters(item: WorkItem, filters: AnalyticsFilters) {
  if (filters.projectId && item.projectId !== filters.projectId) return false;
  if (filters.userId && item.assignedToUserId !== filters.userId) return false;
  if (filters.status && item.status !== filters.status) return false;
  if (filters.priority && item.priority !== filters.priority) return false;
  if (filters.stage && item.stage !== filters.stage) return false;
  return matchesDateRange(item, filters);
}

function groupCount(items: WorkItem[], keyForItem: (item: WorkItem) => string) {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const key = keyForItem(item) || "Unassigned";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label));
}

function buildDailyTrend(items: WorkItem[], dateForItem: (item: WorkItem) => Date | null, fallbackDays = 14) {
  const dated = items.map(dateForItem).filter((date): date is Date => Boolean(date));
  const latest = dated.length ? new Date(Math.max(...dated.map((date) => date.getTime()))) : new Date();
  const labels = Array.from({ length: fallbackDays }, (_, index) => {
    const date = new Date(latest);
    date.setDate(latest.getDate() - (fallbackDays - index - 1));
    return dateKey(date);
  });
  const counts = new Map(labels.map((label) => [label, 0]));
  dated.forEach((date) => {
    const key = dateKey(date);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return labels.map((label) => ({ label, value: counts.get(label) ?? 0 }));
}

function buildVelocity(items: WorkItem[]) {
  const completed = items.filter((item) => COMPLETE_STATUSES.has(item.status)).map((item) => item.completedAt ?? item.updatedAt).filter((date): date is Date => Boolean(date));
  const latest = completed.length ? new Date(Math.max(...completed.map((date) => date.getTime()))) : new Date();
  const labels = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(latest);
    date.setDate(latest.getDate() - (7 * (7 - index)));
    return weekKey(date);
  });
  const counts = new Map(labels.map((label) => [label, 0]));
  completed.forEach((date) => {
    const key = weekKey(date);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return labels.map((label) => ({ label, value: counts.get(label) ?? 0 }));
}

function capacityLabel(percent: number) {
  if (percent >= 115) return "Overallocated";
  if (percent >= 100) return "High";
  if (percent >= 70) return "Healthy";
  return "Available";
}

function buildWorkload(items: WorkItem[], users: UserShape[], filters: AnalyticsFilters) {
  const capacityHours = businessDaysBetween(filters.startDate, filters.endDate) * 8;
  const rowsByUser = new Map<string, {
    userId: string;
    name: string;
    role: string;
    assigned: number;
    completed: number;
    inProgress: number;
    overdue: number;
    estimatedWorkloadHours: number;
  }>();

  users.forEach((user) => {
    rowsByUser.set(id(user._id), {
      userId: id(user._id),
      name: user.fullName || user.email,
      role: user.role ?? "unknown",
      assigned: 0,
      completed: 0,
      inProgress: 0,
      overdue: 0,
      estimatedWorkloadHours: 0,
    });
  });

  const now = new Date();
  items.forEach((item) => {
    const key = item.assignedToUserId || "unassigned";
    const row = rowsByUser.get(key) ?? {
      userId: key,
      name: item.assignedToName,
      role: item.assignedToRole,
      assigned: 0,
      completed: 0,
      inProgress: 0,
      overdue: 0,
      estimatedWorkloadHours: 0,
    };
    row.assigned += 1;
    if (COMPLETE_STATUSES.has(item.status)) row.completed += 1;
    if (ACTIVE_STATUSES.has(item.status)) row.inProgress += 1;
    if (item.dueAt && item.dueAt < now && !CLOSED_STATUSES.has(item.status)) row.overdue += 1;
    if (!CLOSED_STATUSES.has(item.status)) row.estimatedWorkloadHours += item.estimatedEffortHours;
    rowsByUser.set(key, row);
  });

  const usersList = [...rowsByUser.values()]
    .filter((row) => row.assigned > 0 || row.estimatedWorkloadHours > 0)
    .map((row) => {
      const capacityPercent = capacityHours > 0 ? Math.round((row.estimatedWorkloadHours / capacityHours) * 100) : 0;
      return { ...row, capacityHours, capacityPercent, capacityLabel: capacityLabel(capacityPercent) };
    })
    .sort((first, second) => second.capacityPercent - first.capacityPercent || second.assigned - first.assigned);

  const teamRows = new Map<string, {
    team: string;
    assigned: number;
    completed: number;
    inProgress: number;
    overdue: number;
    estimatedWorkloadHours: number;
    capacityHours: number;
  }>();

  usersList.forEach((row) => {
    const key = row.role || "unknown";
    const team = teamRows.get(key) ?? {
      team: key.replaceAll("_", " "),
      assigned: 0,
      completed: 0,
      inProgress: 0,
      overdue: 0,
      estimatedWorkloadHours: 0,
      capacityHours: 0,
    };
    team.assigned += row.assigned;
    team.completed += row.completed;
    team.inProgress += row.inProgress;
    team.overdue += row.overdue;
    team.estimatedWorkloadHours += row.estimatedWorkloadHours;
    team.capacityHours += row.capacityHours;
    teamRows.set(key, team);
  });

  const teams = [...teamRows.values()].map((team) => {
    const capacityPercent = team.capacityHours > 0 ? Math.round((team.estimatedWorkloadHours / team.capacityHours) * 100) : 0;
    return { ...team, capacityPercent, capacityLabel: capacityLabel(capacityPercent) };
  });

  return { users: usersList, teams };
}

function buildStageProgress(items: WorkItem[]) {
  return groupCount(items, (item) => item.stage || "No Stage").map((stage) => {
    const stageItems = items.filter((item) => (item.stage || "No Stage") === stage.label);
    const completed = stageItems.filter((item) => COMPLETE_STATUSES.has(item.status)).length;
    return {
      label: stage.label,
      total: stageItems.length,
      completed,
      percent: stageItems.length ? Math.round((completed / stageItems.length) * 100) : 0,
    };
  });
}

export async function getTaskAnalytics(actor: TaskActor, filters: AnalyticsFilters = {}) {
  await connectToDatabase();

  if (filters.userId && filters.userId !== actor.userId && !canViewTeamAnalytics(actor.role)) {
    throw new Error(`Forbidden for role ${actor.role}`);
  }

  const taskQuery: Record<string, unknown> = {};
  if (filters.projectId) taskQuery.projectId = filters.projectId;
  if (!canViewTeamAnalytics(actor.role)) {
    taskQuery.$or = [{ assignedToUserId: actor.userId }, { createdBy: actor.userId }];
  }

  const [tasks, users] = await Promise.all([
    TaskModel.find(taskQuery)
      .select("title status priority assignedToUserId createdBy projectId parentTaskId startAt dueAt completedAt createdAt updatedAt estimatedEffortHours stage workflowGroup subTasks")
      .populate("assignedToUserId", "fullName email role status")
      .populate("subTasks.assignedToUserId", "fullName email role status")
      .lean<TaskShape[]>(),
    canViewTeamAnalytics(actor.role)
      ? UserModel.find({ status: "active" }).select("fullName email role status").sort({ fullName: 1 }).lean<UserShape[]>()
      : UserModel.find({ _id: actor.userId }).select("fullName email role status").lean<UserShape[]>(),
  ]);

  const accessibleParentTaskIds = [
    ...new Set(
      tasks
        .map((task) => id(task.parentTaskId) || id(task._id))
        .filter(Boolean),
    ),
  ];
  const dependencies = accessibleParentTaskIds.length
    ? await TaskDependencyModel.find({ parentTaskId: { $in: accessibleParentTaskIds } })
        .select("parentTaskId predecessorSubtaskId successorSubtaskId")
        .lean<DependencyForAnalytics[]>()
    : [];

  const parentTasks = tasks.filter((task) => !task.parentTaskId);
  const advancedSubtasks = tasks.filter((task) => task.parentTaskId);
  const normalized = [
    ...parentTasks.map((task) => normalizeTask(task, "task")),
    ...advancedSubtasks.map((task) => normalizeTask(task, "subtask")),
    ...parentTasks.flatMap((task) => (task.subTasks ?? []).map((subtask) => normalizeEmbeddedSubtask(task, subtask))),
  ];
  const filteredItems = normalized.filter((item) => matchesFilters(item, filters));
  const filteredTasks = filteredItems.filter((item) => item.type === "task");
  const filteredSubtasks = filteredItems.filter((item) => item.type !== "task");
  const now = new Date();
  const completedItems = filteredItems.filter((item) => COMPLETE_STATUSES.has(item.status));
  const inProgressItems = filteredItems.filter((item) => ACTIVE_STATUSES.has(item.status));
  const blockedItems = filteredItems.filter((item) => item.status === "BLOCKED");
  const overdueItems = filteredItems.filter((item) => item.dueAt && item.dueAt < now && !CLOSED_STATUSES.has(item.status));
  const completionDurations = completedItems
    .filter((item) => item.completedAt && item.createdAt)
    .map((item) => daysBetween(item.createdAt as Date, item.completedAt as Date));

  const dependencyEdges = dependencies.filter((dependency) => {
    const predecessor = id(dependency.predecessorSubtaskId);
    const successor = id(dependency.successorSubtaskId);
    return filteredItems.some((item) => item.id === predecessor) && filteredItems.some((item) => item.id === successor);
  });

  const projectOptions = groupCount(normalized.filter((item) => item.projectId), (item) => item.projectId).map((item) => ({
    id: item.label,
    label: `Project ${item.label.slice(-6)}`,
  }));
  const stageOptions = groupCount(normalized.filter((item) => item.stage), (item) => item.stage).map((item) => item.label);

  const analytics = {
    filters: {
      projectId: filters.projectId ?? "",
      userId: filters.userId ?? "",
      status: filters.status ?? "",
      priority: filters.priority ?? "",
      startDate: filters.startDate ? dateKey(filters.startDate) : "",
      endDate: filters.endDate ? dateKey(filters.endDate) : "",
      stage: filters.stage ?? "",
    },
    options: {
      projects: projectOptions,
      stages: stageOptions,
      users: users.map((user) => ({ _id: id(user._id), fullName: user.fullName, email: user.email, role: user.role ?? "" })),
    },
    metrics: {
      totalTasks: filteredTasks.length,
      totalSubtasks: filteredSubtasks.length,
      completed: completedItems.length,
      inProgress: inProgressItems.length,
      blocked: blockedItems.length,
      overdue: overdueItems.length,
      averageCompletionTimeDays: completionDurations.length
        ? Math.round((completionDurations.reduce((sum, value) => sum + value, 0) / completionDurations.length) * 10) / 10
        : null,
      projectCompletionPercent: filteredItems.length ? Math.round((completedItems.length / filteredItems.length) * 100) : 0,
      dependencies: dependencyEdges.length,
    },
    charts: {
      completionTrend: buildDailyTrend(completedItems, (item) => item.completedAt ?? item.updatedAt),
      statusDistribution: groupCount(filteredItems, (item) => statusLabel(item.status)),
      priorityDistribution: groupCount(filteredItems, (item) => item.priority),
      teamWorkload: groupCount(filteredItems.filter((item) => !CLOSED_STATUSES.has(item.status)), (item) => item.assignedToName),
      overdueTrend: buildDailyTrend(overdueItems, (item) => item.dueAt),
      stageProgress: buildStageProgress(filteredItems),
      taskVelocity: buildVelocity(filteredItems),
    },
    workload: buildWorkload(filteredItems, users, filters),
  };

  return serializeForJson(analytics);
}

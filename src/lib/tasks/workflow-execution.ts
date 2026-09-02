import { ActivityLogModel, TaskDependencyModel, TaskModel } from "@/models";
import { isDependencyBranchActive, isDependencySatisfied } from "@/lib/tasks/dependencies";
import { isCancelledStatus, isCompletedStatus, normalizeTaskStatus } from "@/lib/tasks/status";
import { serializeForJson } from "@/lib/utils/serialize";

type ExecutionState = "completed" | "active" | "ready" | "blocked" | "overdue" | "waiting" | "upcoming";

type LeanSubtask = {
  _id: unknown;
  code?: string;
  title: string;
  status?: string;
  dueAt?: Date | string | null;
  progressPercent?: number;
  workflowNodeType?: string;
  workflowDecision?: string;
};

type LeanDependency = {
  _id: unknown;
  predecessorSubtaskId: LeanSubtask | string;
  successorSubtaskId: LeanSubtask | string;
  dependencyType?: string;
  branchKey?: string;
  branchLabel?: string;
};

function idOf(value: unknown) {
  if (typeof value === "string") return value;
  return String((value as { _id?: unknown })?._id ?? value);
}

function asSubtask(value: LeanSubtask | string) {
  return typeof value === "string" ? null : value;
}

/**
 * Is this due date genuinely in the past - meaning before today, not merely earlier today?
 *
 * The comparison used to be against the *end* of today, which every due date falling today
 * satisfies, so everything due today was reported overdue in the counts, the overdue list and
 * the canvas colouring. Work is overdue once its day has passed.
 */
function isPast(value?: Date | string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return date.getTime() < todayStart.getTime();
}

export function calculateExecutionState(
  subtask: LeanSubtask,
  incoming: LeanDependency[],
): { state: ExecutionState; blockedBy: LeanDependency[]; waitingOnInactiveBranch: boolean } {
  const status = normalizeTaskStatus(subtask.status);

  if (status === "COMPLETED") return { state: "completed", blockedBy: [], waitingOnInactiveBranch: false };
  if (status === "IN_PROGRESS" || status === "REVIEW" || status === "CLIENT_REVIEW") {
    return { state: "active", blockedBy: [], waitingOnInactiveBranch: false };
  }
  if (status === "WAITING") return { state: "waiting", blockedBy: [], waitingOnInactiveBranch: false };

  const activeIncoming = incoming.filter((dependency) =>
    isDependencyBranchActive(dependency, asSubtask(dependency.predecessorSubtaskId)),
  );
  const inactiveIncoming = incoming.filter((dependency) => !activeIncoming.includes(dependency));
  const blockedBy = activeIncoming.filter((dependency) => {
    const predecessor = asSubtask(dependency.predecessorSubtaskId);
    return !isDependencySatisfied(predecessor?.status, dependency.dependencyType);
  });

  if (blockedBy.length > 0 || status === "BLOCKED") return { state: "blocked", blockedBy, waitingOnInactiveBranch: false };
  if (isPast(subtask.dueAt)) return { state: "overdue", blockedBy: [], waitingOnInactiveBranch: false };
  if (activeIncoming.length > 0) return { state: "ready", blockedBy: [], waitingOnInactiveBranch: false };
  if (inactiveIncoming.length > 0) return { state: "upcoming", blockedBy: [], waitingOnInactiveBranch: true };
  if (status === "READY") return { state: "ready", blockedBy: [], waitingOnInactiveBranch: false };
  return { state: "upcoming", blockedBy: [], waitingOnInactiveBranch: false };
}

export async function getWorkflowExecutionSummary(parentTaskId: string) {
  const [parent, subtasks, dependencies, activity] = await Promise.all([
    TaskModel.findById(parentTaskId).select("title status progressPercent").lean(),
    TaskModel.find({ parentTaskId, archivedAt: null }).sort({ order: 1, createdAt: 1 }).lean(),
    TaskDependencyModel.find({ parentTaskId })
      .sort({ createdAt: 1 })
      .populate("predecessorSubtaskId", "code title status dueAt workflowNodeType workflowDecision progressPercent")
      .populate("successorSubtaskId", "code title status dueAt workflowNodeType workflowDecision progressPercent")
      .lean(),
    ActivityLogModel.find({ entityType: "task", entityId: parentTaskId })
      .sort({ createdAt: -1 })
      .limit(25)
      .populate("actorId", "fullName email role")
      .lean(),
  ]);

  if (!parent) return null;

  const incoming = new Map<string, LeanDependency[]>();
  dependencies.forEach((dependency) => {
    const successorId = idOf(dependency.successorSubtaskId);
    incoming.set(successorId, [...(incoming.get(successorId) ?? []), dependency as unknown as LeanDependency]);
  });

  const nodes = subtasks.map((subtask) => {
    const execution = calculateExecutionState(subtask as LeanSubtask, incoming.get(String(subtask._id)) ?? []);
    return {
      _id: String(subtask._id),
      code: subtask.code,
      title: subtask.title,
      status: subtask.status,
      dueAt: subtask.dueAt,
      progressPercent: subtask.progressPercent ?? 0,
      workflowNodeType: subtask.workflowNodeType,
      workflowDecision: subtask.workflowDecision,
      executionState: execution.state,
      blockedBy: execution.blockedBy.map((dependency) => asSubtask(dependency.predecessorSubtaskId)).filter(Boolean),
      waitingOnInactiveBranch: execution.waitingOnInactiveBranch,
    };
  });

  const total = nodes.length;
  const completed = nodes.filter((node) => isCompletedStatus(node.status)).length;
  const taskProgress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const blockedTasks = nodes.filter((node) => node.executionState === "blocked");
  const overdueTasks = nodes.filter((node) => node.executionState === "overdue");
  const criticalBlockers = blockedTasks
    .filter((node) => node.blockedBy.length > 0)
    .slice(0, 10);

  return serializeForJson({
    taskId: parentTaskId,
    taskProgress,
    counts: {
      total,
      completed,
      active: nodes.filter((node) => node.executionState === "active").length,
      ready: nodes.filter((node) => node.executionState === "ready").length,
      blocked: blockedTasks.length,
      overdue: overdueTasks.length,
      waiting: nodes.filter((node) => node.executionState === "waiting").length,
      upcoming: nodes.filter((node) => node.executionState === "upcoming").length,
    },
    nextAvailableTasks: nodes.filter((node) => node.executionState === "ready").slice(0, 10),
    blockedTasks,
    overdueTasks,
    criticalBlockers,
    nodes,
    activity,
  });
}

/**
 * Recompute a parent's progress from its children.
 *
 * Two things are deliberately excluded from the denominator, and both used to be counted:
 *
 * - Archived subtasks. They are no longer part of the plan, so counting them meant archiving
 *   work made the parent's progress go *down*.
 * - Cancelled subtasks. Cancelled work can never reach COMPLETED, so a single cancelled child
 *   capped its parent below 100% permanently.
 *
 * A parent whose children are all cancelled or archived has nothing outstanding, which reads
 * as complete rather than as 0%.
 */
export async function syncParentTaskProgress(parentTaskId: string) {
  const subtasks = await TaskModel.find({ parentTaskId, archivedAt: null })
    .select("status")
    .lean();

  const countable = subtasks.filter((subtask) => !isCancelledStatus(subtask.status));
  const total = countable.length;
  // Counts normalised status, so a parent whose children carry legacy `done` no longer
  // computes 0% progress.
  const completed = countable.filter((subtask) => isCompletedStatus(subtask.status)).length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  await TaskModel.updateOne({ _id: parentTaskId }, { $set: { progressPercent } });
  return { total, completed, progressPercent };
}

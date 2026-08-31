import type { ClientSession } from "mongoose";
import { TaskDependencyModel, TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { normalizeTaskStatus } from "@/lib/tasks/status";

export type DependencyType = "FINISH_TO_START" | "START_TO_START" | "FINISH_TO_FINISH";

type DependencyActor = {
  userId: string;
};

type DependencyInput = {
  parentTaskId: string;
  predecessorSubtaskId: string;
  successorSubtaskId: string;
  dependencyType?: DependencyType;
  lagDuration?: number | null;
  branchKey?: string;
  branchLabel?: string;
};

type LeanTask = {
  _id: unknown;
  parentTaskId?: unknown;
  status?: string;
  workflowNodeType?: string;
  workflowDecision?: string;
};

function sameId(first: unknown, second: unknown) {
  return String(first) === String(second);
}

export function isDependencySatisfied(predecessorStatus?: string, dependencyType?: string) {
  const status = normalizeTaskStatus(predecessorStatus);

  // START_TO_START clears as soon as the predecessor is genuinely underway; the other types need
  // it finished.
  if (dependencyType === "START_TO_START") {
    return ["IN_PROGRESS", "REVIEW", "CLIENT_REVIEW", "COMPLETED"].includes(status);
  }

  return status === "COMPLETED";
}

function normalizeDecision(value?: string | null) {
  return (value ?? "").trim().toUpperCase();
}

export function isDependencyBranchActive(
  dependency: { branchKey?: string | null; branchLabel?: string | null },
  predecessor?: { workflowNodeType?: string; workflowDecision?: string } | null,
) {
  const branchKey = normalizeDecision(dependency.branchKey || dependency.branchLabel);
  if (!branchKey) return true;
  if (!["CONDITION", "APPROVAL"].includes(predecessor?.workflowNodeType ?? "")) return true;
  return normalizeDecision(predecessor?.workflowDecision) === branchKey;
}

type DependencyWriteOptions = {
  session?: ClientSession;
};

async function assertSubtasksBelongToParent(
  parentTaskId: string,
  predecessorSubtaskId: string,
  successorSubtaskId: string,
  options?: DependencyWriteOptions,
) {
  const subtasks = await TaskModel.find({
    _id: { $in: [predecessorSubtaskId, successorSubtaskId] },
    parentTaskId,
  })
    .select("_id parentTaskId status")
    .session(options?.session ?? null)
    .lean();

  const predecessor = subtasks.find((task: LeanTask) => sameId(task._id, predecessorSubtaskId));
  const successor = subtasks.find((task: LeanTask) => sameId(task._id, successorSubtaskId));

  if (!predecessor || !successor) {
    throw new Error("Both dependency subtasks must belong to this task.");
  }

  return { predecessor, successor };
}

async function wouldCreateCycle(
  parentTaskId: string,
  predecessorSubtaskId: string,
  successorSubtaskId: string,
  options?: DependencyWriteOptions,
) {
  const dependencies = await TaskDependencyModel.find({ parentTaskId })
    .select("predecessorSubtaskId successorSubtaskId")
    .session(options?.session ?? null)
    .lean();
  const adjacency = new Map<string, string[]>();

  for (const dependency of dependencies) {
    const predecessor = String(dependency.predecessorSubtaskId);
    const successor = String(dependency.successorSubtaskId);
    adjacency.set(predecessor, [...(adjacency.get(predecessor) ?? []), successor]);
  }

  adjacency.set(predecessorSubtaskId, [...(adjacency.get(predecessorSubtaskId) ?? []), successorSubtaskId]);

  const seen = new Set<string>();
  const stack = [successorSubtaskId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    if (current === predecessorSubtaskId) return true;
    seen.add(current);
    stack.push(...(adjacency.get(current) ?? []));
  }

  return false;
}

export async function recalculateSubtaskDependencyState(subtaskId: string, options?: DependencyWriteOptions) {
  const dependencies = await TaskDependencyModel.find({ successorSubtaskId: subtaskId })
    .populate("predecessorSubtaskId", "status workflowNodeType workflowDecision")
    .session(options?.session ?? null)
    .lean();

  const activeDependencies = dependencies.filter((dependency) => {
    const predecessor = dependency.predecessorSubtaskId as unknown as LeanTask | null;
    return isDependencyBranchActive(dependency, predecessor);
  });
  const blocked = activeDependencies.some((dependency) => {
    const predecessor = dependency.predecessorSubtaskId as unknown as LeanTask | null;
    return !isDependencySatisfied(predecessor?.status, dependency.dependencyType);
  });

  const subtask = await TaskModel.findById(subtaskId).session(options?.session ?? null);
  if (!subtask) return null;

  const previousStatus = String(subtask.status);

  if (blocked && !["COMPLETED", "CANCELLED"].includes(String(subtask.status))) {
    subtask.status = "BLOCKED";
    await subtask.save({ session: options?.session });
  }

  if (!blocked && activeDependencies.length > 0 && ["NOT_STARTED", "WAITING", "BLOCKED"].includes(String(subtask.status))) {
    subtask.status = "READY";
    await subtask.save({ session: options?.session });
  }

  const nextStatus = String(subtask.status);
  return { subtask, previousStatus, nextStatus, changed: previousStatus !== nextStatus };
}

export async function recalculateSuccessorsForPredecessor(predecessorSubtaskId: string, options?: DependencyWriteOptions) {
  const dependencies = await TaskDependencyModel.find({ predecessorSubtaskId })
    .select("successorSubtaskId")
    .session(options?.session ?? null)
    .lean();
  const successorIds = [...new Set(dependencies.map((dependency) => String(dependency.successorSubtaskId)))];
  return Promise.all(successorIds.map((successorId) => recalculateSubtaskDependencyState(successorId, options)));
}

export async function createDependency(input: DependencyInput, actor: DependencyActor, options?: DependencyWriteOptions) {
  if (input.predecessorSubtaskId === input.successorSubtaskId) {
    throw new Error("A subtask cannot depend on itself.");
  }

  await assertSubtasksBelongToParent(
    input.parentTaskId,
    input.predecessorSubtaskId,
    input.successorSubtaskId,
    options,
  );

  const duplicate = await TaskDependencyModel.exists({
    parentTaskId: input.parentTaskId,
    predecessorSubtaskId: input.predecessorSubtaskId,
    successorSubtaskId: input.successorSubtaskId,
    dependencyType: input.dependencyType ?? "FINISH_TO_START",
  }).session(options?.session ?? null);
  if (duplicate) {
    throw new Error("This dependency already exists.");
  }

  if (await wouldCreateCycle(input.parentTaskId, input.predecessorSubtaskId, input.successorSubtaskId, options)) {
    throw new Error("Circular subtask dependencies are not allowed.");
  }

  const [dependency] = await TaskDependencyModel.create(
    [
      {
        parentTaskId: input.parentTaskId,
        predecessorSubtaskId: input.predecessorSubtaskId,
        successorSubtaskId: input.successorSubtaskId,
        dependencyType: input.dependencyType ?? "FINISH_TO_START",
        lagDuration: input.lagDuration ?? null,
        branchKey: input.branchKey ?? "",
        branchLabel: input.branchLabel ?? "",
        createdBy: actor.userId,
      },
    ],
    { session: options?.session },
  );

  await recalculateSubtaskDependencyState(input.successorSubtaskId, options);
  return dependency;
}

export async function deleteDependency(parentTaskId: string, dependencyId: string, options?: DependencyWriteOptions) {
  const dependency = await TaskDependencyModel.findOne({ _id: dependencyId, parentTaskId }).session(options?.session ?? null);
  if (!dependency) {
    throw new Error("Dependency not found.");
  }

  const successorSubtaskId = String(dependency.successorSubtaskId);
  await dependency.deleteOne({ session: options?.session });
  await recalculateSubtaskDependencyState(successorSubtaskId, options);
  return dependency;
}

export async function getDependencyMap(parentTaskId: string) {
  const dependencies = await TaskDependencyModel.find({ parentTaskId })
    .sort({ createdAt: 1 })
    .populate("predecessorSubtaskId", "code title status workflowNodeType workflowDecision")
    .populate("successorSubtaskId", "code title status workflowNodeType workflowDecision")
    .lean();

  const bySuccessor = new Map<string, unknown[]>();
  const byPredecessor = new Map<string, unknown[]>();

  for (const dependency of dependencies) {
    const successor = String((dependency.successorSubtaskId as { _id?: unknown })._id ?? dependency.successorSubtaskId);
    const predecessor = String((dependency.predecessorSubtaskId as { _id?: unknown })._id ?? dependency.predecessorSubtaskId);
    bySuccessor.set(successor, [...(bySuccessor.get(successor) ?? []), dependency]);
    byPredecessor.set(predecessor, [...(byPredecessor.get(predecessor) ?? []), dependency]);
  }

  return {
    dependencies: serializeForJson(dependencies),
    bySuccessor,
    byPredecessor,
  };
}

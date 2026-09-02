import type { ClientSession } from "mongoose";
import { TaskDependencyModel, TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { normalizeTaskStatus, isClosedStatus } from "@/lib/tasks/status";
import { logActivity } from "@/lib/activity/logging";

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
    .select("_id parentTaskId status archivedAt")
    .session(options?.session ?? null)
    .lean();

  const predecessor = subtasks.find((task: LeanTask) => sameId(task._id, predecessorSubtaskId));
  const successor = subtasks.find((task: LeanTask) => sameId(task._id, successorSubtaskId));

  if (!predecessor || !successor) {
    throw new Error("Both dependency subtasks must belong to this task.");
  }

  // An archived subtask still exists and still matches parentTaskId, so this has to be an
  // explicit check - otherwise archived work can be wired into a live execution graph.
  if ((predecessor as { archivedAt?: Date | null }).archivedAt) {
    throw new Error("Cannot depend on an archived subtask.");
  }
  if ((successor as { archivedAt?: Date | null }).archivedAt) {
    throw new Error("Cannot add a dependency to an archived subtask.");
  }

  return { predecessor, successor };
}

/**
 * Would adding `predecessor -> successor` to `edges` close a loop?
 *
 * Pure and synchronous so it can be exercised directly in tests: self-dependency, A->B->A, and
 * arbitrary-depth chains. Walks forward from the successor looking for the predecessor - if the
 * successor can already reach the predecessor, the new edge closes a cycle.
 *
 * The `seen` set bounds the walk, so a graph that is already corrupt cannot spin here.
 */
export function edgesWouldCreateCycle(
  edges: Array<{ predecessorSubtaskId: unknown; successorSubtaskId: unknown }>,
  predecessorSubtaskId: string,
  successorSubtaskId: string,
) {
  if (predecessorSubtaskId === successorSubtaskId) return true;

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const predecessor = String(edge.predecessorSubtaskId);
    const successor = String(edge.successorSubtaskId);
    adjacency.set(predecessor, [...(adjacency.get(predecessor) ?? []), successor]);
  }

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

  return edgesWouldCreateCycle(dependencies, predecessorSubtaskId, successorSubtaskId);
}

/**
 * Statuses the engine may move a task out of when its dependencies clear.
 *
 * Deliberately excludes IN_PROGRESS and the review states: once someone has picked work up, the
 * engine must not reach in and relabel it. It also never sets IN_PROGRESS itself - clearing
 * dependencies makes work READY, and a person starts it.
 */
const ENGINE_OWNED_STATUSES = ["NOT_STARTED", "WAITING", "BLOCKED"] as const;

export type DependencyReadiness = {
  /** Every active predecessor satisfies its dependency rule. */
  dependencySatisfied: boolean;
  isBlockedByDependencies: boolean;
  /** Not blocked, has at least one real predecessor, and is not already underway or closed. */
  readyToStart: boolean;
  activeDependencyCount: number;
  blockingDependencyCount: number;
};

/** Compute readiness without writing anything. */
export function computeReadiness(
  currentStatus: string | null | undefined,
  dependencies: Array<{
    dependencyType?: string;
    branchKey?: string | null;
    branchLabel?: string | null;
    predecessorSubtaskId: unknown;
  }>,
): DependencyReadiness {
  const active = dependencies.filter((dependency) =>
    isDependencyBranchActive(dependency, dependency.predecessorSubtaskId as LeanTask | null),
  );
  const blocking = active.filter((dependency) => {
    const predecessor = dependency.predecessorSubtaskId as LeanTask | null;
    return !isDependencySatisfied(predecessor?.status, dependency.dependencyType);
  });

  const status = normalizeTaskStatus(currentStatus);
  const isBlockedByDependencies = blocking.length > 0;

  return {
    dependencySatisfied: !isBlockedByDependencies,
    isBlockedByDependencies,
    readyToStart:
      !isBlockedByDependencies &&
      active.length > 0 &&
      (ENGINE_OWNED_STATUSES as readonly string[]).includes(status),
    activeDependencyCount: active.length,
    blockingDependencyCount: blocking.length,
  };
}

export async function recalculateSubtaskDependencyState(subtaskId: string, options?: DependencyWriteOptions) {
  const dependencies = await TaskDependencyModel.find({ successorSubtaskId: subtaskId })
    .populate("predecessorSubtaskId", "status workflowNodeType workflowDecision")
    .session(options?.session ?? null)
    .lean();

  const subtask = await TaskModel.findById(subtaskId).session(options?.session ?? null);
  if (!subtask) return null;

  // Normalised throughout: comparing the raw value meant a legacy `done` subtask did not match
  // "COMPLETED" and could be forced to BLOCKED, and a legacy `todo` one never became READY.
  const previousStatus = normalizeTaskStatus(subtask.status);
  const readiness = computeReadiness(subtask.status, dependencies);

  if (readiness.isBlockedByDependencies && !isClosedStatus(subtask.status)) {
    subtask.status = "BLOCKED";
    await subtask.save({ session: options?.session });
  } else if (readiness.readyToStart) {
    // READY only. Starting the work is a person's decision, never the engine's.
    subtask.status = "READY";
    await subtask.save({ session: options?.session });
  } else if (previousStatus === "BLOCKED" && !isClosedStatus(subtask.status)) {
    // Nothing blocks it any more, but readyToStart requires at least one live predecessor -
    // so a subtask whose last dependency was deleted (or whose only predecessors ended up on
    // an inactive branch) matched neither branch above and stayed BLOCKED forever, with
    // nothing left in the graph that could ever clear it. Release it explicitly: READY when
    // it still has predecessors that are all satisfied, NOT_STARTED when it has none left
    // and is simply an independent subtask again.
    subtask.status = readiness.activeDependencyCount > 0 ? "READY" : "NOT_STARTED";
    await subtask.save({ session: options?.session });
  }

  const nextStatus = normalizeTaskStatus(subtask.status);
  const changed = previousStatus !== nextStatus;

  // NOT_STARTED is included so releasing a stranded BLOCKED subtask leaves a trail too.
  if (changed && ["READY", "BLOCKED", "NOT_STARTED"].includes(nextStatus)) {
    await logActivity({
      action: nextStatus === "BLOCKED" ? "subtask_blocked" : "subtask_ready",
      actorId: null,
      entityType: "task",
      entityId: String(subtask._id),
      details: {
        code: subtask.code ?? null,
        from: previousStatus,
        to: nextStatus,
        blockingDependencies: readiness.blockingDependencyCount,
        // Derived by the engine rather than requested by a person, so there is no actor.
        source: "dependency_engine",
      },
    });
  }

  return { subtask, previousStatus, nextStatus, changed, readiness };
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

  // Any existing edge between this pair, in either direction, regardless of type.
  //
  // The unique index only covers (predecessor, successor, type), which left two contradictory
  // rules between the same pair - A finish-to-start B *and* A start-to-start B - both insertable,
  // with the readiness engine then evaluating both. A reverse edge is equally invalid: it is a
  // two-node cycle, caught below, but reporting it as a duplicate is the clearer message.
  const existing = await TaskDependencyModel.findOne({
    parentTaskId: input.parentTaskId,
    $or: [
      {
        predecessorSubtaskId: input.predecessorSubtaskId,
        successorSubtaskId: input.successorSubtaskId,
      },
      {
        predecessorSubtaskId: input.successorSubtaskId,
        successorSubtaskId: input.predecessorSubtaskId,
      },
    ],
  })
    .select("predecessorSubtaskId")
    .session(options?.session ?? null)
    .lean();

  if (existing) {
    throw sameId(existing.predecessorSubtaskId, input.predecessorSubtaskId)
      ? new Error("These subtasks are already linked.")
      : new Error("These subtasks are already linked in the opposite direction.");
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

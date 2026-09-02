/**
 * Validation for the Phase 1 task foundation: status normalisation, completion derivation, and
 * the widened root-task schemas.
 *
 * Pure logic only - no database connection, so this runs anywhere. Follows the existing
 * validate-task-subtask-schemas.ts pattern because the repo has no test runner yet.
 *
 * Run: npm run test:task-foundation
 */

import {
  normalizeTaskStatus,
  toLegacyTaskStatus,
  isCompletedStatus,
  isClosedStatus,
  getCompletionFields,
} from "../src/lib/tasks/status";
import {
  createTaskSchema,
  updateTaskSchema,
  bulkUpdateTasksSchema,
  duplicateTaskSchema,
  anyTaskStatusSchema,
} from "../src/lib/validation/task";
import { createProjectSchema, updateProjectSchema } from "../src/lib/validation/project";
import {
  edgesWouldCreateCycle,
  computeReadiness,
  isDependencySatisfied,
  isDependencyBranchActive,
} from "../src/lib/tasks/dependencies";
import {
  STATUS_TONE,
  PRIORITY_TONE,
  dueLabel,
  humanize,
  initialsOf,
  isOverdue,
  priorityTone,
  progressTone,
  statusTone,
} from "../src/lib/tasks/tone";

let failures = 0;

function check(label: string, condition: boolean) {
  if (!condition) {
    failures += 1;
    console.error(`  FAIL  ${label}`);
  }
}

function expectThrows(label: string, fn: () => unknown) {
  try {
    fn();
    failures += 1;
    console.error(`  FAIL  ${label} (expected a rejection, got none)`);
  } catch {
    // expected
  }
}

const OID = "507f1f77bcf86cd799439011";

// --- status normalisation ------------------------------------------------------------------

check("legacy todo normalises", normalizeTaskStatus("todo") === "NOT_STARTED");
check("legacy in_progress normalises", normalizeTaskStatus("in_progress") === "IN_PROGRESS");
check("legacy done normalises", normalizeTaskStatus("done") === "COMPLETED");
check("canonical passes through", normalizeTaskStatus("BLOCKED") === "BLOCKED");
check("CLIENT_REVIEW is canonical", normalizeTaskStatus("CLIENT_REVIEW") === "CLIENT_REVIEW");
check("empty defaults to NOT_STARTED", normalizeTaskStatus(undefined) === "NOT_STARTED");
check("unknown defaults to NOT_STARTED", normalizeTaskStatus("nonsense") === "NOT_STARTED");

check("legacy done counts as completed", isCompletedStatus("done"));
check("COMPLETED counts as completed", isCompletedStatus("COMPLETED"));
check("BLOCKED is not completed", !isCompletedStatus("BLOCKED"));
check("CANCELLED is closed", isClosedStatus("CANCELLED"));
check("REVIEW is not closed", !isClosedStatus("REVIEW"));

check("canonical narrows back to legacy", toLegacyTaskStatus("BLOCKED") === "in_progress");
check("COMPLETED narrows to done", toLegacyTaskStatus("COMPLETED") === "done");

// --- completion derivation -----------------------------------------------------------------

const completedFromLegacy = getCompletionFields("done");
check("legacy done sets completedAt", completedFromLegacy.completedAt instanceof Date);
check("legacy done forces 100%", completedFromLegacy.progressPercent === 100);

const completedFromCanonical = getCompletionFields("COMPLETED", 40);
check("COMPLETED overrides supplied progress", completedFromCanonical.progressPercent === 100);

const inProgress = getCompletionFields("IN_PROGRESS", 35);
check("open status clears completedAt", inProgress.completedAt === null);
check("open status keeps supplied progress", inProgress.progressPercent === 35);

const cancelled = getCompletionFields("CANCELLED", 20);
check("cancelled does not stamp completedAt", cancelled.completedAt === null);

// --- task schemas --------------------------------------------------------------------------

check("anyTaskStatusSchema takes legacy", anyTaskStatusSchema.safeParse("todo").success);
check("anyTaskStatusSchema takes canonical", anyTaskStatusSchema.safeParse("CLIENT_REVIEW").success);
check("anyTaskStatusSchema rejects junk", !anyTaskStatusSchema.safeParse("SORT_OF_DONE").success);

check(
  "createTaskSchema accepts a full advanced payload",
  createTaskSchema.safeParse({
    title: "Build lead management module",
    priority: "HIGH",
    status: "IN_PROGRESS",
    startAt: "2026-09-01",
    dueAt: "2026-09-10",
    tags: ["delivery"],
    projectId: OID,
  }).success,
);

check(
  "createTaskSchema rejects due before start",
  !createTaskSchema.safeParse({
    title: "Backwards schedule",
    startAt: "2026-09-10",
    dueAt: "2026-09-01",
  }).success,
);

check("createTaskSchema rejects a short title", !createTaskSchema.safeParse({ title: "ab" }).success);

check(
  "updateTaskSchema accepts legacy status",
  updateTaskSchema.safeParse({ status: "done" }).success,
);
check(
  "updateTaskSchema accepts canonical status",
  updateTaskSchema.safeParse({ status: "BLOCKED" }).success,
);
check(
  "updateTaskSchema rejects out-of-range progress",
  !updateTaskSchema.safeParse({ progressPercent: 140 }).success,
);
check(
  "updateTaskSchema allows detaching a parent",
  updateTaskSchema.safeParse({ parentTaskId: null }).success,
);

check(
  "bulk update requires at least one field",
  !bulkUpdateTasksSchema.safeParse({ taskIds: [OID], patch: {} }).success,
);
check(
  "bulk update accepts a status patch",
  bulkUpdateTasksSchema.safeParse({ taskIds: [OID], patch: { status: "COMPLETED" } }).success,
);
check(
  "bulk update rejects an empty id list",
  !bulkUpdateTasksSchema.safeParse({ taskIds: [], patch: { priority: "HIGH" } }).success,
);
check(
  "bulk update rejects a malformed id",
  !bulkUpdateTasksSchema.safeParse({ taskIds: ["nope"], patch: { priority: "HIGH" } }).success,
);

const duplicateDefaults = duplicateTaskSchema.parse({});
check("duplicate includes children by default", duplicateDefaults.includeChildren === true);
check("duplicate resets status by default", duplicateDefaults.resetStatus === true);

// --- project schemas -----------------------------------------------------------------------

check(
  "createProjectSchema accepts a minimal project",
  createProjectSchema.safeParse({ title: "Nemnidhi site rebuild" }).success,
);
check(
  "createProjectSchema defaults status to planned",
  createProjectSchema.parse({ title: "Nemnidhi site rebuild" }).status === "planned",
);
check(
  "createProjectSchema rejects end before start",
  !createProjectSchema.safeParse({
    title: "Backwards project",
    startDate: "2026-10-01",
    targetEndDate: "2026-09-01",
  }).success,
);
check(
  "updateProjectSchema rejects an empty patch",
  !updateProjectSchema.safeParse({}).success,
);
check(
  "updateProjectSchema rejects an unknown status",
  !updateProjectSchema.safeParse({ status: "paused" }).success,
);

// The embedded array must not be reachable as a write path any more. The field is still accepted
// by the schema for backward compatibility, but both route handlers ignore it - this asserts the
// schema shape has not been widened in a way that suggests otherwise.
expectThrows("createTaskSchema still requires a title", () =>
  createTaskSchema.parse({ subTasks: [{ title: "orphan" }] }),
);

// --- presentation: design.md section 2 -------------------------------------------------------
//
// These lock the canonical mapping. The audit found it reimplemented across eight components with
// divergent results, so a regression here means the divergence is creeping back.

check("every canonical status has a tone", Object.keys(STATUS_TONE).length === 9);
check("every priority has a tone", Object.keys(PRIORITY_TONE).length === 4);

check("IN_PROGRESS is blue, not purple", statusTone("IN_PROGRESS").includes("vega-blue"));
check("legacy in_progress resolves to the same tone", statusTone("in_progress") === statusTone("IN_PROGRESS"));
check("legacy done resolves to COMPLETED tone", statusTone("done") === statusTone("COMPLETED"));
check("BLOCKED is red", statusTone("BLOCKED").includes("vega-red"));
check("READY is green", statusTone("READY").includes("66dc91"));
check("CLIENT_REVIEW is cyan", statusTone("CLIENT_REVIEW").includes("vega-cyan"));

check("HIGH priority is orange, not yellow", priorityTone("HIGH").includes("vega-orange"));
check("URGENT priority is red", priorityTone("URGENT").includes("vega-red"));
check("unknown priority falls back to MEDIUM", priorityTone("NONSENSE") === priorityTone("MEDIUM"));

check("completed progress bar is green", progressTone("COMPLETED").includes("vega-green"));
check("blocked progress bar is red", progressTone("BLOCKED").includes("vega-red"));
check("in-progress bar is blue", progressTone("IN_PROGRESS").includes("vega-blue"));

check("humanize formats an enum", humanize("CLIENT_REVIEW") === "Client Review");
check("initials take two parts", initialsOf("Abhishek Prajapat") === "AP");
check("initials handle a single name", initialsOf("Vega") === "V");
check("initials handle empty input", initialsOf("   ") === "?");

const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
const future = new Date(Date.now() + 3 * 86_400_000).toISOString();

check("overdue work is flagged", isOverdue(past, "IN_PROGRESS"));
check("completed work is never overdue", !isOverdue(past, "COMPLETED"));
check("cancelled work is never overdue", !isOverdue(past, "CANCELLED"));
check("future work is not overdue", !isOverdue(future, "IN_PROGRESS"));
check("undated work is not overdue", !isOverdue(null, "IN_PROGRESS"));

check("overdue label reads Overdue", dueLabel(past, "IN_PROGRESS").text.startsWith("Overdue"));
check("overdue label is red", dueLabel(past, "IN_PROGRESS").tone.includes("vega-red"));
check("near-term work counts down", dueLabel(future, "IN_PROGRESS").text === "3 days left");
check("closed work shows a plain date", !dueLabel(past, "COMPLETED").text.startsWith("Overdue"));
check("missing date reads No date", dueLabel(null, "IN_PROGRESS").text === "No date");
check("invalid date reads No date", dueLabel("not-a-date", "IN_PROGRESS").text === "No date");

// --- dependency engine: cycles ---------------------------------------------------------------
//
// Circular dependency detection has to hold at arbitrary depth and is enforced server-side.

const edge = (predecessorSubtaskId: string, successorSubtaskId: string) => ({
  predecessorSubtaskId,
  successorSubtaskId,
});

check("self-dependency is a cycle", edgesWouldCreateCycle([], "A", "A"));
check("first edge on an empty graph is fine", !edgesWouldCreateCycle([], "A", "B"));
check("A->B then B->A is a cycle", edgesWouldCreateCycle([edge("A", "B")], "B", "A"));
check(
  "A->B->C then C->A is a cycle",
  edgesWouldCreateCycle([edge("A", "B"), edge("B", "C")], "C", "A"),
);
check(
  "deep chain closing back is a cycle",
  edgesWouldCreateCycle(
    [edge("A", "B"), edge("B", "C"), edge("C", "D"), edge("D", "E"), edge("E", "F")],
    "F",
    "A",
  ),
);
check(
  "closing into the middle of a chain is a cycle",
  edgesWouldCreateCycle(
    [edge("A", "B"), edge("B", "C"), edge("C", "D"), edge("D", "E")],
    "E",
    "C",
  ),
);
check(
  "a diamond is not a cycle",
  !edgesWouldCreateCycle([edge("A", "B"), edge("A", "C"), edge("B", "D")], "C", "D"),
);
check(
  "converging on a shared successor is not a cycle",
  !edgesWouldCreateCycle([edge("FRONTEND", "INTEGRATION")], "BACKEND", "INTEGRATION"),
);
check(
  "a disconnected component is not a cycle",
  !edgesWouldCreateCycle([edge("A", "B"), edge("C", "D")], "B", "C"),
);
check(
  "an already-cyclic graph still terminates",
  edgesWouldCreateCycle([edge("A", "B"), edge("B", "A"), edge("B", "C")], "C", "A"),
);

// --- dependency engine: satisfaction ---------------------------------------------------------

check(
  "finish-to-start needs completion",
  isDependencySatisfied("COMPLETED", "FINISH_TO_START") &&
    !isDependencySatisfied("IN_PROGRESS", "FINISH_TO_START"),
);
check(
  "finish-to-start accepts legacy done",
  isDependencySatisfied("done", "FINISH_TO_START"),
);
check(
  "start-to-start clears once underway",
  isDependencySatisfied("IN_PROGRESS", "START_TO_START"),
);
check(
  "start-to-start is not satisfied by NOT_STARTED",
  !isDependencySatisfied("NOT_STARTED", "START_TO_START"),
);
check(
  "start-to-start accepts legacy in_progress",
  isDependencySatisfied("in_progress", "START_TO_START"),
);
check(
  "a cancelled predecessor never satisfies",
  !isDependencySatisfied("CANCELLED", "FINISH_TO_START"),
);

// --- dependency engine: branch gating --------------------------------------------------------

check(
  "an unbranched edge is always active",
  isDependencyBranchActive({ branchKey: "" }, { workflowNodeType: "CONDITION", workflowDecision: "NO" }),
);
check(
  "a branch edge on a plain subtask is active",
  isDependencyBranchActive({ branchKey: "YES" }, { workflowNodeType: "SUBTASK" }),
);
check(
  "a matching branch is active",
  isDependencyBranchActive(
    { branchKey: "YES" },
    { workflowNodeType: "CONDITION", workflowDecision: "YES" },
  ),
);
check(
  "a non-matching branch is inactive",
  !isDependencyBranchActive(
    { branchKey: "YES" },
    { workflowNodeType: "CONDITION", workflowDecision: "NO" },
  ),
);

// --- dependency engine: readiness ------------------------------------------------------------
//
// The multi-predecessor case from the phase spec: Integration depends on Frontend and Backend,
// and stays blocked until both are satisfied.

const dep = (status: string, dependencyType = "FINISH_TO_START") => ({
  dependencyType,
  predecessorSubtaskId: { status, workflowNodeType: "SUBTASK" },
});

const bothIncomplete = computeReadiness("NOT_STARTED", [dep("IN_PROGRESS"), dep("NOT_STARTED")]);
check("blocked while predecessors are open", bothIncomplete.isBlockedByDependencies);
check("not ready while blocked", !bothIncomplete.readyToStart);
check("counts both blockers", bothIncomplete.blockingDependencyCount === 2);

const onePending = computeReadiness("NOT_STARTED", [dep("COMPLETED"), dep("IN_PROGRESS")]);
check("one satisfied predecessor is not enough", onePending.isBlockedByDependencies);
check("counts the single remaining blocker", onePending.blockingDependencyCount === 1);

const allDone = computeReadiness("NOT_STARTED", [dep("COMPLETED"), dep("COMPLETED")]);
check("clears when every predecessor completes", allDone.dependencySatisfied);
check("becomes ready to start", allDone.readyToStart);

check(
  "a task with no dependencies is never auto-readied",
  !computeReadiness("NOT_STARTED", []).readyToStart,
);
check(
  "work already in progress is left alone",
  !computeReadiness("IN_PROGRESS", [dep("COMPLETED")]).readyToStart,
);
check(
  "completed work is never re-readied",
  !computeReadiness("COMPLETED", [dep("COMPLETED")]).readyToStart,
);
check(
  "review work is left alone",
  !computeReadiness("REVIEW", [dep("COMPLETED")]).readyToStart,
);
check(
  "a blocked task can become ready again",
  computeReadiness("BLOCKED", [dep("COMPLETED")]).readyToStart,
);
check(
  "legacy todo can become ready",
  computeReadiness("todo", [dep("COMPLETED")]).readyToStart,
);
check(
  "an inactive branch does not block",
  !computeReadiness("NOT_STARTED", [
    {
      dependencyType: "FINISH_TO_START",
      branchKey: "YES",
      predecessorSubtaskId: {
        status: "COMPLETED",
        workflowNodeType: "CONDITION",
        workflowDecision: "NO",
      },
    },
  ]).isBlockedByDependencies,
);

console.log("");
if (failures > 0) {
  console.error(`Task foundation validation FAILED with ${failures} problem(s).`);
  process.exitCode = 1;
} else {
  console.log("Task foundation validation passed.");
}

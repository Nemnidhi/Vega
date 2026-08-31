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

console.log("");
if (failures > 0) {
  console.error(`Task foundation validation FAILED with ${failures} problem(s).`);
  process.exitCode = 1;
} else {
  console.log("Task foundation validation passed.");
}

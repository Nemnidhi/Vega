/**
 * Regression tests for the pure-logic fixes from the 2026-08-31 system audit.
 *
 * Only covers the parts that are genuinely testable without a database - the normalizers, the
 * overdue boundary, the readiness calculation and the constant-time secret compare. The
 * findings that live in query shape or route wiring (index creation, the proxy allowlist,
 * session revocation) are verified by `npm run sync:indexes -- --dry`, the build, and manual
 * checks respectively.
 *
 *   npm run test:audit-fixes
 *
 * Exits non-zero on the first failure.
 */
import assert from "node:assert/strict";
import { Types } from "mongoose";
import {
  normalizeAttachments,
  normalizeChecklist,
  normalizeComments,
} from "@/lib/tasks/subtasks";
import { calculateExecutionState } from "@/lib/tasks/workflow-execution";
import { computeReadiness } from "@/lib/tasks/dependencies";
import { secretsMatch } from "@/lib/auth/secrets";
import type { UserRole } from "@/types/user";

const AUTHOR = { userId: "aaaaaaaaaaaaaaaaaaaaaaaa", role: "developer" as UserRole };
const EDITOR = { userId: "bbbbbbbbbbbbbbbbbbbbbbbb", role: "developer" as UserRole };

const checks: Array<[string, () => void]> = [];
function check(name: string, run: () => void) {
  checks.push([name, run]);
}

function daysFromToday(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

// ---------------------------------------------------------------- H-03

check("an existing comment keeps its author when someone else edits the subtask", () => {
  const existingId = new Types.ObjectId();
  const originalCreatedAt = new Date("2026-08-01T10:00:00.000Z");

  const stored = [
    { _id: existingId, body: "Original note", createdBy: AUTHOR.userId, createdAt: originalCreatedAt },
  ];

  const result = normalizeComments(
    [
      { _id: String(existingId), body: "Original note" },
      { body: "A reply from someone else" },
    ],
    EDITOR,
    stored,
  );

  assert.equal(result.length, 2);
  assert.equal(result[0].createdBy, AUTHOR.userId, "existing comment was reattributed");
  assert.equal(
    (result[0].createdAt as Date).getTime(),
    originalCreatedAt.getTime(),
    "existing comment was redated",
  );
  assert.equal(result[0].updatedAt, null, "unchanged body should not count as an edit");
  assert.equal(result[1].createdBy, EDITOR.userId, "new comment should belong to the editor");
});

check("editing a comment's body records updatedAt but keeps the original author", () => {
  const existingId = new Types.ObjectId();
  const stored = [
    { _id: existingId, body: "Before", createdBy: AUTHOR.userId, createdAt: new Date("2026-08-01T10:00:00.000Z") },
  ];

  const [comment] = normalizeComments([{ _id: String(existingId), body: "After" }], EDITOR, stored);

  assert.equal(comment.createdBy, AUTHOR.userId);
  assert.notEqual(comment.updatedAt, null, "an actual body change should set updatedAt");
});

check("an existing attachment keeps its uploader", () => {
  const existingId = new Types.ObjectId();
  const uploadedAt = new Date("2026-07-15T09:00:00.000Z");
  const stored = [{ _id: existingId, uploadedBy: AUTHOR.userId, uploadedAt }];

  const [attachment] = normalizeAttachments(
    [{ _id: String(existingId), name: "spec.pdf", url: "https://example.com/spec.pdf" }],
    EDITOR,
    stored,
  );

  assert.equal(attachment.uploadedBy, AUTHOR.userId);
  assert.equal((attachment.uploadedAt as Date).getTime(), uploadedAt.getTime());
});

check("an already-completed checklist item keeps who ticked it off", () => {
  const existingId = new Types.ObjectId();
  const completedAt = new Date("2026-08-02T08:30:00.000Z");
  const stored = [{ _id: existingId, completed: true, completedBy: AUTHOR.userId, completedAt }];

  const [item] = normalizeChecklist(
    [{ _id: String(existingId), title: "Ship it", completed: true }],
    EDITOR,
    stored,
  );

  assert.equal(item.completedBy, AUTHOR.userId);
  assert.equal((item.completedAt as Date).getTime(), completedAt.getTime());
});

check("newly completing a checklist item records the person who did it", () => {
  const existingId = new Types.ObjectId();
  const stored = [{ _id: existingId, completed: false, completedBy: null, completedAt: null }];

  const [item] = normalizeChecklist(
    [{ _id: String(existingId), title: "Ship it", completed: true }],
    EDITOR,
    stored,
  );

  assert.equal(item.completedBy, EDITOR.userId);
  assert.notEqual(item.completedAt, null);
});

check("unticking a checklist item clears its completion record", () => {
  const existingId = new Types.ObjectId();
  const stored = [
    { _id: existingId, completed: true, completedBy: AUTHOR.userId, completedAt: new Date() },
  ];

  const [item] = normalizeChecklist(
    [{ _id: String(existingId), title: "Ship it", completed: false }],
    EDITOR,
    stored,
  );

  assert.equal(item.completed, false);
  assert.equal(item.completedBy, null);
  assert.equal(item.completedAt, null);
});

check("creating a subtask with no stored entries still stamps the actor", () => {
  const [comment] = normalizeComments([{ body: "First" }], AUTHOR);
  assert.equal(comment.createdBy, AUTHOR.userId);
});

// ---------------------------------------------------------------- M-04

check("a subtask due today is not overdue", () => {
  const { state } = calculateExecutionState(
    { _id: "1", title: "Due today", status: "NOT_STARTED", dueAt: daysFromToday(0) },
    [],
  );
  assert.notEqual(state, "overdue", "work due today still has the day to be done in");
});

check("a subtask due at the very end of today is not overdue", () => {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const { state } = calculateExecutionState(
    { _id: "1", title: "Due tonight", status: "NOT_STARTED", dueAt: endOfToday },
    [],
  );
  assert.notEqual(state, "overdue");
});

check("a subtask due yesterday is overdue", () => {
  const { state } = calculateExecutionState(
    { _id: "1", title: "Due yesterday", status: "NOT_STARTED", dueAt: daysFromToday(-1) },
    [],
  );
  assert.equal(state, "overdue");
});

check("a subtask due tomorrow is not overdue", () => {
  const { state } = calculateExecutionState(
    { _id: "1", title: "Due tomorrow", status: "NOT_STARTED", dueAt: daysFromToday(1) },
    [],
  );
  assert.notEqual(state, "overdue");
});

check("a completed subtask is never reported overdue", () => {
  const { state } = calculateExecutionState(
    { _id: "1", title: "Done late", status: "COMPLETED", dueAt: daysFromToday(-5) },
    [],
  );
  assert.equal(state, "completed");
});

// ---------------------------------------------------------------- H-04

check("a subtask with no dependencies left is not blocked", () => {
  const readiness = computeReadiness("BLOCKED", []);
  assert.equal(readiness.isBlockedByDependencies, false);
  assert.equal(readiness.activeDependencyCount, 0);
  // readyToStart stays false with no predecessors, which is exactly why
  // recalculateSubtaskDependencyState needs its explicit release branch - without it a
  // subtask in this state stayed BLOCKED with nothing blocking it.
  assert.equal(readiness.readyToStart, false);
});

check("a subtask whose only predecessor is complete becomes ready", () => {
  const readiness = computeReadiness("BLOCKED", [
    { dependencyType: "FINISH_TO_START", predecessorSubtaskId: { _id: "p1", status: "COMPLETED" } },
  ]);
  assert.equal(readiness.isBlockedByDependencies, false);
  assert.equal(readiness.readyToStart, true);
});

check("a subtask with an unfinished predecessor stays blocked", () => {
  const readiness = computeReadiness("NOT_STARTED", [
    { dependencyType: "FINISH_TO_START", predecessorSubtaskId: { _id: "p1", status: "IN_PROGRESS" } },
  ]);
  assert.equal(readiness.isBlockedByDependencies, true);
  assert.equal(readiness.blockingDependencyCount, 1);
});

check("the engine does not relabel work someone has already started", () => {
  const readiness = computeReadiness("IN_PROGRESS", [
    { dependencyType: "FINISH_TO_START", predecessorSubtaskId: { _id: "p1", status: "COMPLETED" } },
  ]);
  assert.equal(readiness.readyToStart, false, "IN_PROGRESS is not engine-owned");
});

// ---------------------------------------------------------------- L-02

check("secretsMatch accepts the correct secret and rejects everything else", () => {
  const secret = "s3cret-value-that-is-long-enough";
  assert.equal(secretsMatch(secret, secret), true);
  assert.equal(secretsMatch("s3cret-value-that-is-long-enougH", secret), false);
  assert.equal(secretsMatch("s3cret", secret), false, "a matching prefix must not pass");
  assert.equal(secretsMatch(`${secret}x`, secret), false);
  assert.equal(secretsMatch("", secret), false);
  assert.equal(secretsMatch(null, secret), false);
  assert.equal(secretsMatch(undefined, secret), false);
});

// ----------------------------------------------------------------

let failed = 0;
for (const [name, run] of checks) {
  try {
    run();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL ${name}`);
    console.error(`       ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${checks.length} audit-fix checks failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} audit-fix checks passed.`);

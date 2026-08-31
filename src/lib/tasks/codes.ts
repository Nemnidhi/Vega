import type { ClientSession } from "mongoose";
import { CounterModel, TaskModel } from "@/models";

/**
 * Human-readable display codes for tasks and subtasks.
 *
 * Shapes: root tasks are `TASK-2478`, children are `ST-2478-1`. These are reference identifiers
 * shown in the UI - `_id` remains the only key anything joins on.
 *
 * Root codes come from an atomic counter rather than a check-then-insert probe, so concurrent
 * creates cannot collide. Child codes derive from the parent's numeric part and are sequenced
 * within that parent.
 */

const TASK_COUNTER_ID = "task_code";

export function normalizeTaskCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function nextSequence(counterId: string, session?: ClientSession) {
  const counter = await CounterModel.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session: session ?? undefined },
  ).lean();

  return (counter as { seq: number }).seq;
}

async function assertCodeIsFree(code: string, session?: ClientSession) {
  const existing = await TaskModel.exists({ code }).session(session ?? null);
  if (existing) {
    throw new Error("Task code already exists.");
  }
}

/**
 * Allocate a root-task code, `TASK-2478`.
 *
 * The counter is seeded above any code already in the collection the first time it runs, so
 * introducing this into a database that already has hand-assigned codes cannot produce a
 * duplicate.
 */
export async function generateTaskCode(requestedCode?: string, options?: { session?: ClientSession }) {
  const session = options?.session;

  if (requestedCode) {
    const code = normalizeTaskCode(requestedCode);
    await assertCodeIsFree(code, session);
    return code;
  }

  await ensureTaskCounterSeeded(session);

  // The counter makes collisions impossible in normal operation; the loop only covers codes that
  // predate the counter and were created outside it.
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const seq = await nextSequence(TASK_COUNTER_ID, session);
    const code = `TASK-${seq}`;
    const existing = await TaskModel.exists({ code }).session(session ?? null);
    if (!existing) return code;
  }

  throw new Error("Could not allocate a task code.");
}

let counterSeeded = false;

async function ensureTaskCounterSeeded(session?: ClientSession) {
  if (counterSeeded) return;

  const existing = await CounterModel.findById(TASK_COUNTER_ID).session(session ?? null).lean();
  if (existing) {
    counterSeeded = true;
    return;
  }

  // Find the highest TASK-<n> already in use so the counter starts above it.
  const highest = await TaskModel.find({ code: /^TASK-\d+$/ })
    .select("code")
    .sort({ code: -1 })
    .limit(200)
    .session(session ?? null)
    .lean();

  const maxSeq = highest.reduce((max, task) => {
    const match = /^TASK-(\d+)$/.exec(String(task.code ?? ""));
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);

  await CounterModel.updateOne(
    { _id: TASK_COUNTER_ID },
    { $setOnInsert: { seq: maxSeq } },
    { upsert: true, session: session ?? undefined },
  );

  counterSeeded = true;
}

/** Test/maintenance hook - forces the next call to re-seed from the collection. */
export function resetTaskCounterSeedCache() {
  counterSeeded = false;
}

/**
 * Allocate a child code from its parent, `ST-2478-1`.
 *
 * Falls back to the parent's id fragment when the parent has no code, which can happen for root
 * tasks created before code generation existed.
 */
export async function generateSubtaskCode(
  parentTaskId: string,
  requestedCode?: string,
  options?: { session?: ClientSession },
) {
  const session = options?.session;

  if (requestedCode) {
    const code = normalizeTaskCode(requestedCode);
    await assertCodeIsFree(code, session);
    return code;
  }

  const parent = await TaskModel.findById(parentTaskId).select("code").session(session ?? null).lean();
  const parentCode = typeof parent?.code === "string" && parent.code ? parent.code : "";

  // `TASK-2478` -> `ST-2478`. Anything else falls back to the id fragment.
  const numericMatch = /^TASK-(\d+)$/.exec(parentCode);
  const base = numericMatch
    ? `ST-${numericMatch[1]}`
    : normalizeTaskCode(`ST-${parentCode || parentTaskId.slice(-6)}`);

  const siblingCount = await TaskModel.countDocuments({ parentTaskId }).session(session ?? null);

  for (let offset = 1; offset <= 50; offset += 1) {
    const code = `${base}-${siblingCount + offset}`;
    const existing = await TaskModel.exists({ code }).session(session ?? null);
    if (!existing) return code;
  }

  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

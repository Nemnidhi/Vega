/**
 * Task status normalisation.
 *
 * Vega's Task collection carries two generations of status values: the original lowercase trio
 * (`todo` / `in_progress` / `done`) written by the root-task routes, and the uppercase execution
 * set written by the subtask routes. Both remain valid in the schema enum so existing rows keep
 * loading, but every read path should normalise before comparing.
 *
 * This exists because the split had already leaked into behaviour: `syncParentTaskProgress` only
 * counted `COMPLETED` children, so a parent whose children were legacy `done` computed 0% progress.
 * Comparing raw status strings anywhere is a bug - use `normalizeTaskStatus` first.
 */

export const canonicalTaskStatuses = [
  "NOT_STARTED",
  "READY",
  "IN_PROGRESS",
  "WAITING",
  "BLOCKED",
  "REVIEW",
  "CLIENT_REVIEW",
  "COMPLETED",
  "CANCELLED",
] as const;

export type CanonicalTaskStatus = (typeof canonicalTaskStatuses)[number];

export const legacyTaskStatuses = ["todo", "in_progress", "done"] as const;

export type LegacyTaskStatus = (typeof legacyTaskStatuses)[number];

export type AnyTaskStatus = CanonicalTaskStatus | LegacyTaskStatus;

const legacyToCanonical: Record<LegacyTaskStatus, CanonicalTaskStatus> = {
  todo: "NOT_STARTED",
  in_progress: "IN_PROGRESS",
  done: "COMPLETED",
};

const canonicalToLegacy: Record<CanonicalTaskStatus, LegacyTaskStatus> = {
  NOT_STARTED: "todo",
  READY: "todo",
  IN_PROGRESS: "in_progress",
  WAITING: "in_progress",
  BLOCKED: "in_progress",
  REVIEW: "in_progress",
  CLIENT_REVIEW: "in_progress",
  COMPLETED: "done",
  CANCELLED: "done",
};

const canonicalSet = new Set<string>(canonicalTaskStatuses);

/** Map any stored status - legacy or canonical - onto the canonical uppercase set. */
export function normalizeTaskStatus(status?: string | null): CanonicalTaskStatus {
  if (!status) return "NOT_STARTED";
  if (canonicalSet.has(status)) return status as CanonicalTaskStatus;
  const legacy = legacyToCanonical[status as LegacyTaskStatus];
  return legacy ?? "NOT_STARTED";
}

/**
 * Narrow a canonical status back to the legacy trio, for the handful of consumers still reading
 * the old values. Lossy by definition - only for backward compatibility, never for storage.
 */
export function toLegacyTaskStatus(status?: string | null): LegacyTaskStatus {
  return canonicalToLegacy[normalizeTaskStatus(status)];
}

export function isCompletedStatus(status?: string | null): boolean {
  return normalizeTaskStatus(status) === "COMPLETED";
}

export function isCancelledStatus(status?: string | null): boolean {
  return normalizeTaskStatus(status) === "CANCELLED";
}

/** Completed or cancelled - work that no longer counts as outstanding. */
export function isClosedStatus(status?: string | null): boolean {
  const normalized = normalizeTaskStatus(status);
  return normalized === "COMPLETED" || normalized === "CANCELLED";
}

/** Statuses that represent work a person is expected to act on right now. */
export function isActiveStatus(status?: string | null): boolean {
  const normalized = normalizeTaskStatus(status);
  return normalized === "IN_PROGRESS" || normalized === "REVIEW" || normalized === "CLIENT_REVIEW";
}

/**
 * Derive `completedAt` / `progressPercent` from a status change.
 *
 * Recognises legacy `done` as well as `COMPLETED` - the previous implementation only matched the
 * uppercase value, so a task closed through the root-task route never got its completion stamp.
 */
export function getCompletionFields(status?: string | null, progressPercent?: number) {
  const normalized = normalizeTaskStatus(status);

  if (normalized === "COMPLETED") {
    return { completedAt: new Date(), progressPercent: 100 };
  }

  return { completedAt: null, progressPercent: progressPercent ?? 0 };
}

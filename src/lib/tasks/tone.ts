import { normalizeTaskStatus, type CanonicalTaskStatus } from "@/lib/tasks/status";

/**
 * The canonical status/priority presentation, per design.md section 2.
 *
 * This module exists because the mapping had been reimplemented in eight components with
 * divergent results - IN_PROGRESS rendered purple in the task detail tabs and blue on the
 * workflow canvas, HIGH priority rendered yellow in one and orange in another. Import from here;
 * do not write another local statusTone().
 */

export const STATUS_OPTIONS: CanonicalTaskStatus[] = [
  "NOT_STARTED",
  "READY",
  "IN_PROGRESS",
  "WAITING",
  "BLOCKED",
  "REVIEW",
  "CLIENT_REVIEW",
  "COMPLETED",
  "CANCELLED",
];

export const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type TaskPriority = (typeof PRIORITY_OPTIONS)[number];

/** Blue is in-progress; green covers both ready (outline) and completed (soft fill). */
export const STATUS_TONE: Record<CanonicalTaskStatus, string> = {
  NOT_STARTED: "border-vega-border bg-vega-surface-2 text-vega-text-muted",
  READY: "border-vega-green/45 bg-transparent text-[#66dc91]",
  IN_PROGRESS: "border-vega-blue/30 bg-vega-blue-soft text-[#93c5fd]",
  WAITING: "border-vega-yellow/30 bg-vega-yellow/10 text-vega-yellow",
  BLOCKED: "border-vega-red/30 bg-vega-red/10 text-vega-red",
  REVIEW: "border-vega-yellow/30 bg-vega-yellow/10 text-vega-yellow",
  CLIENT_REVIEW: "border-vega-cyan/30 bg-vega-cyan/10 text-vega-cyan",
  COMPLETED: "border-vega-green/35 bg-vega-green/10 text-[#66dc91]",
  CANCELLED: "border-vega-red/25 bg-transparent text-vega-red/70",
};

/** HIGH is orange, not yellow - yellow is reserved for review/waiting states. */
export const PRIORITY_TONE: Record<string, string> = {
  URGENT: "border-vega-red/30 bg-vega-red/10 text-vega-red",
  HIGH: "border-vega-orange/30 bg-vega-orange/10 text-vega-orange",
  MEDIUM: "border-vega-purple-border bg-vega-purple-soft text-[#c4b5fd]",
  LOW: "border-vega-border bg-vega-surface-2 text-vega-text-muted",
};

/** Progress-bar fill, matched to the row's state. */
export function progressTone(status?: string | null) {
  const normalized = normalizeTaskStatus(status);
  if (normalized === "COMPLETED") return "bg-vega-green";
  if (normalized === "BLOCKED") return "bg-vega-red";
  return "bg-vega-blue";
}

export function statusTone(status?: string | null) {
  return STATUS_TONE[normalizeTaskStatus(status)];
}

export function priorityTone(priority?: string | null) {
  return PRIORITY_TONE[priority ?? "MEDIUM"] ?? PRIORITY_TONE.MEDIUM;
}

/** `IN_PROGRESS` -> `In Progress`. */
export function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0 || !parts[0]) return "?";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Relative due-date copy, per design.md: Overdue / Today / N days left, falling back to a short
 * date beyond a week. Closed work shows the plain date - "3 days left" on a finished task is noise.
 */
export function dueLabel(dueAt?: string | null, status?: string | null) {
  if (!dueAt) return { text: "No date", tone: "text-vega-text-dim" };

  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return { text: "No date", tone: "text-vega-text-dim" };

  const normalized = normalizeTaskStatus(status);
  const closed = normalized === "COMPLETED" || normalized === "CANCELLED";

  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const days = Math.round((dueDay.getTime() - startOfToday().getTime()) / 86_400_000);
  const formatted = due.toLocaleDateString(undefined, { day: "numeric", month: "short" });

  if (closed) return { text: formatted, tone: "text-vega-text-muted" };
  if (days < 0) return { text: `Overdue · ${formatted}`, tone: "text-vega-red" };
  if (days === 0) return { text: "Today", tone: "text-vega-orange" };
  if (days === 1) return { text: "1 day left", tone: "text-vega-yellow" };
  if (days <= 7) return { text: `${days} days left`, tone: "text-vega-yellow" };
  return { text: formatted, tone: "text-vega-text-secondary" };
}

export function isOverdue(dueAt?: string | null, status?: string | null) {
  const normalized = normalizeTaskStatus(status);
  if (normalized === "COMPLETED" || normalized === "CANCELLED" || !dueAt) return false;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

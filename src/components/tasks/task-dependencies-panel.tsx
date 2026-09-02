"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Link2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { normalizeTaskStatus } from "@/lib/tasks/status";
import { humanize, initialsOf, statusTone } from "@/lib/tasks/tone";

/**
 * The Dependencies tab, per design.md.
 *
 * Reads and writes through the existing dependency routes. Cycle rejection is enforced
 * server-side by lib/tasks/dependencies.ts - the client-side filtering here removes obviously
 * invalid choices from the picker as a courtesy, and is never the control.
 */

type PopulatedUser = { _id: string; fullName: string; email?: string; role?: string };

type DependencyRef = { _id: string; code?: string; title: string; status: string };

type Dependency = {
  _id: string;
  predecessorSubtaskId: DependencyRef | string;
  successorSubtaskId: DependencyRef | string;
  dependencyType: string;
};

type SubtaskOption = {
  _id: string;
  code?: string;
  title: string;
  status: string;
  assignedToUserId?: PopulatedUser | string | null;
  blockedBy?: Dependency[];
  blocking?: Dependency[];
};

const DEPENDENCY_TYPES = [
  { value: "FINISH_TO_START", label: "Finish → Start" },
  { value: "START_TO_START", label: "Start → Start" },
  { value: "FINISH_TO_FINISH", label: "Finish → Finish" },
];

function refOf(value: DependencyRef | string): DependencyRef {
  if (typeof value === "string") return { _id: value, title: value, status: "" };
  return value;
}

function displayName(user: PopulatedUser | string | null | undefined) {
  if (!user) return "Unassigned";
  return typeof user === "string" ? "Unknown" : user.fullName;
}

function DependencyCard({
  reference,
  assignee,
  dependencyType,
  onRemove,
  busy,
  canEdit,
}: {
  reference: DependencyRef;
  assignee?: PopulatedUser | string | null;
  dependencyType: string;
  onRemove?: () => void;
  busy?: boolean;
  canEdit: boolean;
}) {
  const blocked = normalizeTaskStatus(reference.status) === "BLOCKED";

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-md border bg-vega-surface-2 px-3 py-2.5",
        blocked ? "border-vega-red/30" : "border-vega-border-soft",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-vega-text">{reference.title}</p>
        <p className="mt-0.5 font-mono text-[10px] text-vega-text-muted">{reference.code ?? "—"}</p>
      </div>

      {assignee !== undefined ? (
        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-vega-border bg-vega-surface-1 text-[8px] font-semibold text-vega-text-secondary">
            {initialsOf(displayName(assignee))}
          </span>
          <span className="max-w-[120px] truncate text-[10px] text-vega-text-muted">
            {displayName(assignee)}
          </span>
        </span>
      ) : null}

      <span className="hidden text-[10px] text-vega-text-dim md:inline">
        {DEPENDENCY_TYPES.find((type) => type.value === dependencyType)?.label ?? dependencyType}
      </span>

      {reference.status ? (
        <span
          className={cn(
            "inline-flex h-[22px] shrink-0 items-center rounded-md border px-2 text-[10px] font-medium",
            statusTone(reference.status),
          )}
        >
          {humanize(normalizeTaskStatus(reference.status))}
        </span>
      ) : null}

      {canEdit && onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label={`Remove dependency on ${reference.title}`}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-vega-text-muted transition-colors hover:border-vega-red/35 hover:bg-vega-red/10 hover:text-vega-red disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
        </button>
      ) : null}
    </li>
  );
}

interface TaskDependenciesPanelProps {
  parentTaskId: string;
  subtasks: SubtaskOption[];
  /** When set, the panel scopes to one subtask. Otherwise it lists every edge under the task. */
  focusSubtaskId?: string | null;
  dependencies: Dependency[];
  canEdit: boolean;
  busy?: boolean;
  onCreate: (input: {
    predecessorSubtaskId: string;
    successorSubtaskId: string;
    dependencyType: string;
  }) => Promise<void> | void;
  onRemove: (dependencyId: string) => Promise<void> | void;
}

export function TaskDependenciesPanel({
  parentTaskId,
  subtasks,
  focusSubtaskId,
  dependencies,
  canEdit,
  busy = false,
  onCreate,
  onRemove,
}: TaskDependenciesPanelProps) {
  const [successorId, setSuccessorId] = useState(focusSubtaskId ?? "");
  const [predecessorId, setPredecessorId] = useState("");
  const [dependencyType, setDependencyType] = useState("FINISH_TO_START");
  const [formError, setFormError] = useState("");

  const subtaskById = useMemo(
    () => new Map(subtasks.map((subtask) => [subtask._id, subtask])),
    [subtasks],
  );

  const scoped = useMemo(() => {
    if (!focusSubtaskId) return dependencies;
    return dependencies.filter(
      (dependency) =>
        refOf(dependency.predecessorSubtaskId)._id === focusSubtaskId ||
        refOf(dependency.successorSubtaskId)._id === focusSubtaskId,
    );
  }, [dependencies, focusSubtaskId]);

  const blockedBy = useMemo(
    () =>
      focusSubtaskId
        ? scoped.filter((dependency) => refOf(dependency.successorSubtaskId)._id === focusSubtaskId)
        : scoped,
    [scoped, focusSubtaskId],
  );

  const blocking = useMemo(
    () =>
      focusSubtaskId
        ? scoped.filter((dependency) => refOf(dependency.predecessorSubtaskId)._id === focusSubtaskId)
        : [],
    [scoped, focusSubtaskId],
  );

  /**
   * Immediate-neighbour exclusions only. Deep cycles are the server's job - reproducing the
   * full graph walk here would duplicate logic that must be authoritative on the backend anyway.
   */
  const predecessorOptions = useMemo(() => {
    if (!successorId) return [];
    const existing = new Set(
      dependencies
        .filter((dependency) => refOf(dependency.successorSubtaskId)._id === successorId)
        .map((dependency) => refOf(dependency.predecessorSubtaskId)._id),
    );
    const reverse = new Set(
      dependencies
        .filter((dependency) => refOf(dependency.predecessorSubtaskId)._id === successorId)
        .map((dependency) => refOf(dependency.successorSubtaskId)._id),
    );
    return subtasks.filter(
      (subtask) =>
        subtask._id !== successorId && !existing.has(subtask._id) && !reverse.has(subtask._id),
    );
  }, [subtasks, dependencies, successorId]);

  async function submit() {
    setFormError("");
    if (!successorId || !predecessorId) {
      setFormError("Pick both the dependent subtask and what it waits on.");
      return;
    }
    if (successorId === predecessorId) {
      setFormError("A subtask cannot depend on itself.");
      return;
    }
    try {
      await onCreate({
        predecessorSubtaskId: predecessorId,
        successorSubtaskId: successorId,
        dependencyType,
      });
      setPredecessorId("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not create the dependency.");
    }
  }

  if (subtasks.length === 0) {
    return (
      <div className="rounded-lg border border-vega-border bg-vega-surface-1 p-10 text-center">
        <p className="text-xs text-vega-text-muted">
          Dependencies connect subtasks. Add subtasks first, then define what waits on what.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="rounded-lg border border-vega-border bg-vega-surface-1 p-4">
          <p className="text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">
            Add Dependency
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex min-w-[180px] flex-1 flex-col gap-1">
              <span className="text-[10px] text-vega-text-muted">Subtask</span>
              <select
                value={successorId}
                onChange={(event) => {
                  setSuccessorId(event.target.value);
                  setPredecessorId("");
                }}
                className="text-xs"
              >
                <option value="">Select a subtask...</option>
                {subtasks.map((subtask) => (
                  <option key={subtask._id} value={subtask._id}>
                    {subtask.code ? `${subtask.code} · ` : ""}
                    {subtask.title}
                  </option>
                ))}
              </select>
            </label>

            <span className="hidden pb-2.5 text-vega-text-dim md:block">
              <ArrowRight className="h-4 w-4 rotate-180" strokeWidth={1.8} aria-hidden="true" />
            </span>

            <label className="flex min-w-[180px] flex-1 flex-col gap-1">
              <span className="text-[10px] text-vega-text-muted">Waits on</span>
              <select
                value={predecessorId}
                onChange={(event) => setPredecessorId(event.target.value)}
                disabled={!successorId}
                className="text-xs"
              >
                <option value="">
                  {successorId ? "Select a predecessor..." : "Pick a subtask first"}
                </option>
                {predecessorOptions.map((subtask) => (
                  <option key={subtask._id} value={subtask._id}>
                    {subtask.code ? `${subtask.code} · ` : ""}
                    {subtask.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-[150px] flex-col gap-1">
              <span className="text-[10px] text-vega-text-muted">Type</span>
              <select
                value={dependencyType}
                onChange={(event) => setDependencyType(event.target.value)}
                className="text-xs"
              >
                {DEPENDENCY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <Button
              variant="primary"
              size="md"
              disabled={busy || !successorId || !predecessorId}
              onClick={() => void submit()}
            >
              <Link2 className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
              Link
            </Button>
          </div>

          {formError ? (
            <p className="mt-3 rounded-md border border-vega-red/25 bg-vega-red/10 p-2.5 text-xs text-vega-red">
              {formError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-vega-border bg-vega-surface-1">
        <div className="border-b border-vega-border-soft px-4 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">
            {focusSubtaskId ? `Blocked By (${blockedBy.length})` : `All Dependencies (${scoped.length})`}
          </p>
        </div>
        <div className="p-4">
          {blockedBy.length === 0 ? (
            <p className="text-xs text-vega-text-muted">
              {focusSubtaskId
                ? "Nothing is blocking this subtask."
                : "No dependencies defined under this task yet."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {blockedBy.map((dependency) => {
                const reference = refOf(dependency.predecessorSubtaskId);
                return (
                  <DependencyCard
                    key={dependency._id}
                    reference={reference}
                    assignee={subtaskById.get(reference._id)?.assignedToUserId}
                    dependencyType={dependency.dependencyType}
                    canEdit={canEdit}
                    busy={busy}
                    onRemove={() => void onRemove(dependency._id)}
                  />
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {focusSubtaskId ? (
        <div className="rounded-lg border border-vega-border bg-vega-surface-1">
          <div className="border-b border-vega-border-soft px-4 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">
              Blocking ({blocking.length})
            </p>
          </div>
          <div className="p-4">
            {blocking.length === 0 ? (
              <p className="text-xs text-vega-text-muted">This subtask is not blocking anything.</p>
            ) : (
              <ul className="space-y-1.5">
                {blocking.map((dependency) => {
                  const reference = refOf(dependency.successorSubtaskId);
                  return (
                    <DependencyCard
                      key={dependency._id}
                      reference={reference}
                      assignee={subtaskById.get(reference._id)?.assignedToUserId}
                      dependencyType={dependency.dependencyType}
                      canEdit={canEdit}
                      busy={busy}
                      onRemove={() => void onRemove(dependency._id)}
                    />
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <p className="text-[10px] text-vega-text-dim">
        Circular dependencies are rejected server-side, at any depth. Task {parentTaskId.slice(-6)}.
      </p>
    </div>
  );
}

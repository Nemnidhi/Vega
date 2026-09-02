"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock,
  Link2,
  ListChecks,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { normalizeTaskStatus } from "@/lib/tasks/status";
import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  dueLabel,
  humanize,
  initialsOf,
  isOverdue as isTaskOverdue,
  priorityTone,
  progressTone,
  statusTone,
} from "@/lib/tasks/tone";

/**
 * The Tasks page table experience, per design.md.
 *
 * Density is the point: 34px controls, ~50-54px rows, 22px badges, 10px column headers. The
 * status/priority colour mapping follows design.md section 2 - do not re-derive it locally.
 */

type PopulatedUser = { _id: string; fullName: string; email: string; role: string };
type PopulatedProject = { _id: string; title: string; status?: string; code?: string };

export type WorkspaceTask = {
  _id: string;
  title: string;
  description?: string;
  code?: string | null;
  status: string;
  priority?: string;
  dueAt: string | null;
  startAt?: string | null;
  progressPercent?: number;
  stage?: string;
  tags?: string[];
  assignedToUserId: PopulatedUser | string | null;
  createdBy: PopulatedUser | string | null;
  projectId: PopulatedProject | string | null;
  subtaskCount?: number;
  subtaskCompletedCount?: number;
  dependencyCount?: number;
};

type ViewKey = "all" | "mine" | "assigned_by_me" | "blocked" | "overdue" | "completed";

const VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: "all", label: "All Tasks" },
  { key: "mine", label: "My Tasks" },
  { key: "assigned_by_me", label: "Assigned by Me" },
  { key: "blocked", label: "Blocked" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

function displayName(user: PopulatedUser | string | null | undefined) {
  if (!user) return "Unassigned";
  return typeof user === "string" ? "Unknown" : user.fullName;
}

function userIdOf(user: PopulatedUser | string | null | undefined) {
  if (!user) return "";
  return typeof user === "string" ? user : user._id;
}

function projectOf(project: PopulatedProject | string | null | undefined) {
  if (!project || typeof project === "string") return null;
  return project;
}

interface TasksWorkspaceProps {
  tasks: WorkspaceTask[];
  currentUserId: string;
  canAssignOthers: boolean;
  assignableUsers: PopulatedUser[];
  onRefresh: () => Promise<void> | void;
  onCreateTask: () => void;
  onImport?: () => void;
  loading?: boolean;
}

export function TasksWorkspace({
  tasks,
  currentUserId,
  canAssignOthers,
  assignableUsers,
  onRefresh,
  onCreateTask,
  onImport,
  loading = false,
}: TasksWorkspaceProps) {
  const [view, setView] = useState<ViewKey>("all");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [dueFilter, setDueFilter] = useState("");
  const [sortKey, setSortKey] = useState("due_asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const projects = useMemo(() => {
    const map = new Map<string, PopulatedProject>();
    for (const task of tasks) {
      const project = projectOf(task.projectId);
      if (project) map.set(project._id, project);
    }
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [tasks]);

  const summary = useMemo(() => {
    let mine = 0;
    let inProgress = 0;
    let ready = 0;
    let blocked = 0;
    let overdue = 0;
    let completed = 0;

    for (const task of tasks) {
      const status = normalizeTaskStatus(task.status);
      if (userIdOf(task.assignedToUserId) === currentUserId) mine += 1;
      if (status === "IN_PROGRESS") inProgress += 1;
      if (status === "READY") ready += 1;
      if (status === "BLOCKED") blocked += 1;
      if (status === "COMPLETED") completed += 1;
      if (isTaskOverdue(task.dueAt, task.status)) overdue += 1;
    }

    return { mine, inProgress, ready, blocked, overdue, completed };
  }, [tasks, currentUserId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = tasks.filter((task) => {
      const status = normalizeTaskStatus(task.status);
      const assigneeId = userIdOf(task.assignedToUserId);
      const creatorId = userIdOf(task.createdBy);

      if (view === "mine" && assigneeId !== currentUserId) return false;
      if (view === "assigned_by_me" && (creatorId !== currentUserId || assigneeId === currentUserId)) {
        return false;
      }
      if (view === "blocked" && status !== "BLOCKED") return false;
      if (view === "overdue" && !isTaskOverdue(task.dueAt, task.status)) return false;
      if (view === "completed" && status !== "COMPLETED") return false;

      if (term) {
        const haystack = `${task.title} ${task.code ?? ""} ${task.description ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (projectFilter) {
        const project = projectOf(task.projectId);
        if ((project?._id ?? "") !== projectFilter) return false;
      }
      if (assigneeFilter && assigneeId !== assigneeFilter) return false;
      if (statusFilter && status !== statusFilter) return false;
      if (priorityFilter && (task.priority ?? "MEDIUM") !== priorityFilter) return false;

      if (dueFilter) {
        if (!task.dueAt) return false;
        const due = new Date(task.dueAt);
        if (Number.isNaN(due.getTime())) return false;
        due.setHours(0, 0, 0, 0);
        const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
        if (dueFilter === "overdue" && !isTaskOverdue(task.dueAt, task.status)) return false;
        if (dueFilter === "today" && days !== 0) return false;
        if (dueFilter === "week" && (days < 0 || days > 7)) return false;
        if (dueFilter === "none") return false;
      }

      return true;
    });

    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "due_desc":
          return (b.dueAt ?? "").localeCompare(a.dueAt ?? "");
        case "title":
          return a.title.localeCompare(b.title);
        case "priority": {
          const rank = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as Record<string, number>;
          return (rank[a.priority ?? "MEDIUM"] ?? 2) - (rank[b.priority ?? "MEDIUM"] ?? 2);
        }
        case "progress":
          return (b.progressPercent ?? 0) - (a.progressPercent ?? 0);
        default:
          // Tasks with no due date sort last rather than first.
          if (!a.dueAt && !b.dueAt) return 0;
          if (!a.dueAt) return 1;
          if (!b.dueAt) return -1;
          return a.dueAt.localeCompare(b.dueAt);
      }
    });

    return sorted;
  }, [
    tasks,
    view,
    search,
    projectFilter,
    assigneeFilter,
    statusFilter,
    priorityFilter,
    dueFilter,
    sortKey,
    currentUserId,
  ]);

  const hasFilters = Boolean(
    search || projectFilter || assigneeFilter || statusFilter || priorityFilter || dueFilter,
  );

  const clearFilters = useCallback(() => {
    setSearch("");
    setProjectFilter("");
    setAssigneeFilter("");
    setStatusFilter("");
    setPriorityFilter("");
    setDueFilter("");
  }, []);

  const visibleIds = useMemo(() => filtered.map((task) => task._id), [filtered]);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const runBulk = useCallback(
    async (patch: Record<string, unknown>) => {
      if (selectedVisible.length === 0) return;
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/tasks/bulk", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskIds: selectedVisible, patch }),
        });
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error?.message ?? "Bulk update failed.");
        }
        setSelected(new Set());
        await onRefresh();
      } catch (bulkError) {
        setError(bulkError instanceof Error ? bulkError.message : "Bulk update failed.");
      } finally {
        setBusy(false);
      }
    },
    [selectedVisible, onRefresh],
  );

  const archiveTask = useCallback(
    async (taskId: string) => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error?.message ?? "Could not archive the task.");
        }
        await onRefresh();
      } catch (archiveError) {
        setError(archiveError instanceof Error ? archiveError.message : "Could not archive the task.");
      } finally {
        setBusy(false);
        setOpenMenuId(null);
      }
    },
    [onRefresh],
  );

  const duplicateTask = useCallback(
    async (taskId: string) => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(`/api/tasks/${taskId}/duplicate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error?.message ?? "Could not duplicate the task.");
        }
        await onRefresh();
      } catch (duplicateError) {
        setError(
          duplicateError instanceof Error ? duplicateError.message : "Could not duplicate the task.",
        );
      } finally {
        setBusy(false);
        setOpenMenuId(null);
      }
    },
    [onRefresh],
  );

  return (
    <div className="space-y-4">
      {/* Operational summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryTile label="My Tasks" value={summary.mine} icon={ListChecks} tone="text-vega-text" />
        <SummaryTile label="In Progress" value={summary.inProgress} icon={CircleDot} tone="text-[#93c5fd]" />
        <SummaryTile label="Ready" value={summary.ready} icon={CheckCircle2} tone="text-[#66dc91]" />
        <SummaryTile label="Blocked" value={summary.blocked} icon={AlertTriangle} tone="text-vega-red" />
        <SummaryTile label="Overdue" value={summary.overdue} icon={Clock} tone="text-vega-orange" />
        <SummaryTile label="Completed" value={summary.completed} icon={CheckCircle2} tone="text-[#66dc91]" />
      </div>

      {/* Views */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-vega-border-soft no-scrollbar">
        {VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setView(item.key)}
            className={cn(
              "whitespace-nowrap px-3 py-3 text-xs font-medium transition-colors",
              view === item.key
                ? "border-b-2 border-vega-purple text-[#c4b5fd]"
                : "text-vega-text-muted hover:text-vega-text-secondary",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vega-text-muted"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks..."
            className="pl-9"
            aria-label="Search tasks"
          />
        </div>

        {projects.length > 0 ? (
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            className="text-xs"
            aria-label="Filter by project"
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.title}
              </option>
            ))}
          </select>
        ) : null}

        {canAssignOthers && assignableUsers.length > 0 ? (
          <select
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            className="text-xs"
            aria-label="Filter by assignee"
          >
            <option value="">All assignees</option>
            {assignableUsers.map((user) => (
              <option key={user._id} value={user._id}>
                {user.fullName}
              </option>
            ))}
          </select>
        ) : null}

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="text-xs"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {humanize(status)}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          className="text-xs"
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((priority) => (
            <option key={priority} value={priority}>
              {humanize(priority)}
            </option>
          ))}
        </select>

        <select
          value={dueFilter}
          onChange={(event) => setDueFilter(event.target.value)}
          className="text-xs"
          aria-label="Filter by due date"
        >
          <option value="">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Next 7 days</option>
        </select>

        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value)}
          className="text-xs"
          aria-label="Sort tasks"
        >
          <option value="due_asc">Due date ↑</option>
          <option value="due_desc">Due date ↓</option>
          <option value="priority">Priority</option>
          <option value="progress">Progress</option>
          <option value="title">Title</option>
        </select>

        {hasFilters ? (
          <Button variant="secondary" size="md" onClick={clearFilters}>
            <X className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
            Clear
          </Button>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {onImport ? (
            <Button variant="secondary" size="md" onClick={onImport}>
              <Upload className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
              Import
            </Button>
          ) : null}
          <Button variant="primary" size="md" onClick={onCreateTask}>
            <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
            Create Task
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-vega-red/25 bg-vega-red/10 p-3 text-xs text-vega-red">
          {error}
        </p>
      ) : null}

      {/* Bulk action bar - only present when a selection exists */}
      {selectedVisible.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-vega-purple-border bg-vega-purple-soft px-3 py-2">
          <span className="text-xs font-medium text-[#c4b5fd]">
            {selectedVisible.length} selected
          </span>
          <select
            defaultValue=""
            disabled={busy}
            onChange={(event) => {
              if (!event.target.value) return;
              void runBulk({ status: event.target.value });
              event.target.value = "";
            }}
            className="text-xs"
            aria-label="Set status for selected tasks"
          >
            <option value="">Set status...</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {humanize(status)}
              </option>
            ))}
          </select>
          <select
            defaultValue=""
            disabled={busy}
            onChange={(event) => {
              if (!event.target.value) return;
              void runBulk({ priority: event.target.value });
              event.target.value = "";
            }}
            className="text-xs"
            aria-label="Set priority for selected tasks"
          >
            <option value="">Set priority...</option>
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {humanize(priority)}
              </option>
            ))}
          </select>
          {canAssignOthers && assignableUsers.length > 0 ? (
            <select
              defaultValue=""
              disabled={busy}
              onChange={(event) => {
                if (!event.target.value) return;
                void runBulk({ assignedToUserId: event.target.value });
                event.target.value = "";
              }}
              className="text-xs"
              aria-label="Assign selected tasks"
            >
              <option value="">Assign to...</option>
              {assignableUsers.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          ) : null}
          <input
            type="date"
            disabled={busy}
            onChange={(event) => {
              if (!event.target.value) return;
              void runBulk({ dueAt: event.target.value });
              event.target.value = "";
            }}
            className="h-[34px] rounded-md border border-vega-border bg-[#0b141f] px-3 text-xs text-vega-text"
            aria-label="Set due date for selected tasks"
          />
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </Button>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-vega-border bg-vega-surface-1">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left">
            <thead className="bg-vega-surface-2 text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    disabled={visibleIds.length === 0}
                    aria-label="Select all tasks"
                    className="h-3.5 w-3.5 accent-[#8b5cf6]"
                  />
                </th>
                <th className="px-3 py-3">Task</th>
                <th className="px-3 py-3">Project</th>
                <th className="px-3 py-3">Assignee</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Priority</th>
                <th className="px-3 py-3">Deps</th>
                <th className="px-3 py-3">Due Date</th>
                <th className="px-3 py-3">Progress</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center">
                    <p className="text-xs text-vega-text-muted">
                      {hasFilters
                        ? "No tasks match these filters."
                        : view === "all"
                          ? "No tasks yet. Create one to start tracking execution."
                          : "Nothing in this view right now."}
                    </p>
                    {hasFilters ? (
                      <Button variant="secondary" size="sm" className="mt-3" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ) : (
                filtered.map((task) => {
                  const status = normalizeTaskStatus(task.status);
                  const priority = task.priority ?? "MEDIUM";
                  const project = projectOf(task.projectId);
                  const assignee = displayName(task.assignedToUserId);
                  const due = dueLabel(task.dueAt, task.status);
                  const progress = task.progressPercent ?? 0;
                  const isSelected = selected.has(task._id);

                  return (
                    <tr
                      key={task._id}
                      className={cn(
                        "border-t border-vega-border-soft transition-colors",
                        isSelected ? "bg-vega-surface-selected" : "hover:bg-vega-surface-hover",
                      )}
                    >
                      <td className="px-3 py-3 align-middle">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(task._id)}
                          aria-label={`Select ${task.title}`}
                          className="h-3.5 w-3.5 accent-[#8b5cf6]"
                        />
                      </td>

                      <td className="max-w-[320px] px-3 py-3">
                        <Link
                          href={`/tasks/${task._id}`}
                          className="block truncate text-xs font-medium text-vega-text hover:text-[#c4b5fd]"
                        >
                          {task.title}
                        </Link>
                        <p className="mt-0.5 font-mono text-[10px] text-vega-text-muted">
                          {task.code ?? "—"}
                          {task.subtaskCount ? (
                            <span className="ml-2 text-vega-text-dim">
                              {task.subtaskCompletedCount ?? 0}/{task.subtaskCount} subtasks
                            </span>
                          ) : null}
                        </p>
                      </td>

                      <td className="px-3 py-3">
                        {project ? (
                          <span className="truncate text-xs text-vega-text-secondary">{project.title}</span>
                        ) : (
                          <span className="text-xs text-vega-text-dim">—</span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-vega-border bg-vega-surface-2 text-[9px] font-semibold text-vega-text-secondary">
                            {initialsOf(assignee)}
                          </span>
                          <span className="truncate text-xs text-vega-text-secondary">{assignee}</span>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex h-[22px] items-center rounded-md border px-2 text-[10px] font-medium",
                            statusTone(task.status),
                          )}
                        >
                          {humanize(status)}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex h-[22px] items-center rounded-md border px-2 text-[10px] font-medium",
                            priorityTone(priority),
                          )}
                        >
                          {humanize(priority)}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        {task.dependencyCount ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px]",
                              status === "BLOCKED" ? "text-vega-red" : "text-vega-text-muted",
                            )}
                          >
                            <Link2 className="h-3 w-3" strokeWidth={1.8} aria-hidden="true" />
                            {task.dependencyCount}
                          </span>
                        ) : (
                          <span className="text-[10px] text-vega-text-dim">—</span>
                        )}
                      </td>

                      <td className={cn("whitespace-nowrap px-3 py-3 text-xs", due.tone)}>{due.text}</td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-sm bg-vega-surface-2">
                            <div
                              className={cn(
                                "h-full rounded-sm",
                                progressTone(task.status),
                              )}
                              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                            />
                          </div>
                          <span className="text-[10px] tabular-nums text-vega-text-muted">{progress}%</span>
                        </div>
                      </td>

                      <td className="relative px-3 py-3 text-right">
                        <button
                          type="button"
                          aria-label={`Actions for ${task.title}`}
                          onClick={() => setOpenMenuId(openMenuId === task._id ? null : task._id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-vega-text-muted transition-colors hover:border-vega-border hover:bg-vega-surface-2 hover:text-vega-text"
                        >
                          <MoreHorizontal className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                        </button>
                        {openMenuId === task._id ? (
                          <div className="absolute right-3 top-11 z-50 w-40 overflow-hidden rounded-md border border-vega-border bg-[#0a141f] shadow-[0_16px_36px_rgba(0,0,0,0.35)]">
                            <Link
                              href={`/tasks/${task._id}`}
                              className="block px-3 py-2 text-xs text-vega-text-secondary hover:bg-vega-surface-hover hover:text-vega-text"
                            >
                              Open
                            </Link>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void duplicateTask(task._id)}
                              className="block w-full px-3 py-2 text-left text-xs text-vega-text-secondary hover:bg-vega-surface-hover hover:text-vega-text disabled:opacity-50"
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void archiveTask(task._id)}
                              className="block w-full border-t border-vega-border-soft px-3 py-2 text-left text-xs text-vega-red hover:bg-vega-red/10 disabled:opacity-50"
                            >
                              Archive
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 ? (
          <div className="flex items-center justify-between border-t border-vega-border-soft px-3 py-2">
            <p className="text-[10px] text-vega-text-muted">
              Showing {filtered.length} of {tasks.length} task{tasks.length === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof ListChecks;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-vega-border bg-vega-surface-1 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">{label}</p>
        <Icon className={cn("h-3.5 w-3.5", tone)} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums text-vega-text">{value}</p>
    </div>
  );
}

/** Skeleton rows at real row height, so the table does not reflow when data lands. */
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index} className="border-t border-vega-border-soft">
          <td className="px-3 py-3">
            <div className="h-3.5 w-3.5 rounded bg-vega-surface-2" />
          </td>
          <td className="px-3 py-3">
            <div className="h-3 w-48 rounded bg-vega-surface-2" />
            <div className="mt-1.5 h-2 w-20 rounded bg-vega-surface-2/70" />
          </td>
          {Array.from({ length: 7 }).map((__, cell) => (
            <td key={cell} className="px-3 py-3">
              <div className="h-3 w-16 rounded bg-vega-surface-2" />
            </td>
          ))}
          <td className="px-3 py-3" />
        </tr>
      ))}
    </>
  );
}

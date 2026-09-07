"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Copy,
  FolderKanban,
  Link2,
  ListChecks,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils/cn";

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
  { key: "all", label: "All" },
  { key: "mine", label: "My tasks" },
  { key: "assigned_by_me", label: "Assigned by me" },
  { key: "blocked", label: "Blocked" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

const selectClass =
  "h-[38px] min-w-0 rounded-md border border-vega-border bg-[#0b141f] px-3 text-xs text-vega-text outline-none transition-colors focus:border-vega-accent/70";
const panelClass = "rounded-lg border border-vega-border bg-vega-surface-1";

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
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    let blocked = 0;
    let overdue = 0;
    let completed = 0;
    for (const task of tasks) {
      const status = normalizeTaskStatus(task.status);
      if (userIdOf(task.assignedToUserId) === currentUserId) mine += 1;
      if (status === "IN_PROGRESS") inProgress += 1;
      if (status === "BLOCKED") blocked += 1;
      if (status === "COMPLETED") completed += 1;
      if (isTaskOverdue(task.dueAt, task.status)) overdue += 1;
    }
    return { total: tasks.length, mine, inProgress, blocked, overdue, completed };
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
      if (view === "assigned_by_me" && (creatorId !== currentUserId || assigneeId === currentUserId)) return false;
      if (view === "blocked" && status !== "BLOCKED") return false;
      if (view === "overdue" && !isTaskOverdue(task.dueAt, task.status)) return false;
      if (view === "completed" && status !== "COMPLETED") return false;
      if (term) {
        const project = projectOf(task.projectId);
        const assignee = displayName(task.assignedToUserId);
        const haystack = `${task.title} ${task.code ?? ""} ${task.description ?? ""} ${project?.title ?? ""} ${assignee}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (projectFilter && projectOf(task.projectId)?._id !== projectFilter) return false;
      if (assigneeFilter && assigneeId !== assigneeFilter) return false;
      if (statusFilter && status !== statusFilter) return false;
      if (priorityFilter && (task.priority ?? "MEDIUM") !== priorityFilter) return false;
      if (dueFilter) {
        if (dueFilter === "none") return !task.dueAt;
        if (!task.dueAt) return false;
        const due = new Date(task.dueAt);
        if (Number.isNaN(due.getTime())) return false;
        due.setHours(0, 0, 0, 0);
        const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
        if (dueFilter === "overdue" && !isTaskOverdue(task.dueAt, task.status)) return false;
        if (dueFilter === "today" && days !== 0) return false;
        if (dueFilter === "week" && (days < 0 || days > 7)) return false;
      }
      return true;
    });
    return [...rows].sort((a, b) => {
      if (sortKey === "due_desc") return (b.dueAt ?? "").localeCompare(a.dueAt ?? "");
      if (sortKey === "title") return a.title.localeCompare(b.title);
      if (sortKey === "priority") {
        const rank: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return (rank[a.priority ?? "MEDIUM"] ?? 2) - (rank[b.priority ?? "MEDIUM"] ?? 2);
      }
      if (sortKey === "progress") return (b.progressPercent ?? 0) - (a.progressPercent ?? 0);
      if (!a.dueAt && !b.dueAt) return 0;
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return a.dueAt.localeCompare(b.dueAt);
    });
  }, [assigneeFilter, currentUserId, dueFilter, priorityFilter, projectFilter, search, sortKey, statusFilter, tasks, view]);

  const activeFilterCount = [projectFilter, assigneeFilter, statusFilter, priorityFilter, dueFilter].filter(Boolean).length;
  const hasFilters = Boolean(search || activeFilterCount);
  const visibleIds = useMemo(() => filtered.map((task) => task._id), [filtered]);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  const clearFilters = useCallback(() => {
    setSearch("");
    setProjectFilter("");
    setAssigneeFilter("");
    setStatusFilter("");
    setPriorityFilter("");
    setDueFilter("");
  }, []);

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of visibleIds) {
        if (allVisibleSelected) next.delete(id);
        else next.add(id);
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

  const runBulk = useCallback(async (patch: Record<string, unknown>) => {
    if (selectedVisible.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/tasks/bulk", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskIds: selectedVisible, patch }) });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message ?? "Bulk update failed.");
      setSelected(new Set());
      await onRefresh();
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : "Bulk update failed.");
    } finally {
      setBusy(false);
    }
  }, [onRefresh, selectedVisible]);

  const archiveTask = useCallback(async (taskId: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message ?? "Could not archive the task.");
      await onRefresh();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Could not archive the task.");
    } finally {
      setBusy(false);
      setOpenMenuId(null);
    }
  }, [onRefresh]);

  const duplicateTask = useCallback(async (taskId: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${taskId}/duplicate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message ?? "Could not duplicate the task.");
      await onRefresh();
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Could not duplicate the task.");
    } finally {
      setBusy(false);
      setOpenMenuId(null);
    }
  }, [onRefresh]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label="Total tasks" value={summary.total} helper={`${summary.mine} assigned to you`} icon={ListChecks} tone="bg-vega-accent-soft text-[#a98bff]" />
        <SummaryTile label="In progress" value={summary.inProgress} helper="Active execution" icon={CircleDot} tone="bg-vega-blue-soft text-[#62b0ff]" />
        <SummaryTile label="Overdue" value={summary.overdue} helper={`${summary.blocked} blocked`} icon={AlertTriangle} tone="bg-vega-red-soft text-[#ff6973]" />
        <SummaryTile label="Completed" value={summary.completed} helper="All completed work" icon={CheckCircle2} tone="bg-vega-green-soft text-[#58e18b]" />
      </div>

      <section className={cn(panelClass, "overflow-visible")}>
        <div className="flex items-center gap-1 overflow-x-auto border-b border-vega-border-soft px-3 pt-2 no-scrollbar">
          {VIEWS.map((item) => (
            <button key={item.key} type="button" onClick={() => setView(item.key)} className={cn("h-9 shrink-0 border-b-2 px-3 text-xs font-medium transition-colors", view === item.key ? "border-vega-accent text-[#b58cff]" : "border-transparent text-vega-text-muted hover:text-vega-text")}>
              {item.label}{item.key === "blocked" && summary.blocked > 0 ? <span className="ml-2 rounded-full bg-vega-red-soft px-1.5 py-0.5 text-[9px] text-vega-red">{summary.blocked}</span> : null}
            </button>
          ))}
        </div>

        <div className="p-3 lg:p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1 lg:max-w-[460px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vega-text-muted" aria-hidden="true" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, project or assignee..." className="h-[38px] pl-9" /></label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFiltersOpen((open) => !open)} className={cn("relative inline-flex h-[38px] flex-1 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium lg:flex-none", filtersOpen || activeFilterCount ? "border-vega-accent-border bg-vega-accent-soft text-[#b58cff]" : "border-vega-border text-vega-text-secondary hover:bg-vega-surface-hover")}><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Filters{activeFilterCount > 0 ? <span className="rounded-full bg-vega-accent px-1.5 py-0.5 text-[9px] text-white">{activeFilterCount}</span> : null}</button>
              {onImport ? <Button variant="secondary" className="flex-1 lg:flex-none" onClick={onImport}><Upload className="mr-2 h-4 w-4" />Import</Button> : null}
            </div>
          </div>

          {filtersOpen ? (
            <div className="mt-3 grid gap-2 border-t border-vega-border-soft pt-3 sm:grid-cols-2 lg:grid-cols-6">
              {projects.length > 0 ? <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className={selectClass} aria-label="Filter by project"><option value="">All projects</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.title}</option>)}</select> : <div className="hidden lg:block" />}
              {canAssignOthers && assignableUsers.length > 0 ? <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} className={selectClass} aria-label="Filter by assignee"><option value="">All assignees</option>{assignableUsers.map((user) => <option key={user._id} value={user._id}>{user.fullName}</option>)}</select> : null}
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={selectClass} aria-label="Filter by status"><option value="">All statuses</option>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select>
              <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className={selectClass} aria-label="Filter by priority"><option value="">All priorities</option>{PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{humanize(priority)}</option>)}</select>
              <select value={dueFilter} onChange={(event) => setDueFilter(event.target.value)} className={selectClass} aria-label="Filter by due date"><option value="">Any due date</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="week">Next 7 days</option><option value="none">No due date</option></select>
              <div className="flex gap-2"><label className="relative min-w-0 flex-1"><ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-vega-text-muted" /><select value={sortKey} onChange={(event) => setSortKey(event.target.value)} className={cn(selectClass, "w-full pl-8")} aria-label="Sort tasks"><option value="due_asc">Due first</option><option value="due_desc">Due last</option><option value="priority">Priority</option><option value="progress">Progress</option><option value="title">Title</option></select></label>{hasFilters ? <button type="button" onClick={clearFilters} className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-vega-border text-vega-text-muted hover:bg-vega-surface-hover" aria-label="Clear filters" title="Clear filters"><X className="h-4 w-4" /></button> : null}</div>
            </div>
          ) : null}
        </div>

        {error ? <p className="mx-3 mb-3 rounded-md border border-vega-red/25 bg-vega-red/10 p-3 text-xs text-vega-red lg:mx-4">{error}</p> : null}

        {selectedVisible.length > 0 ? (
          <div className="mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-md border border-vega-accent-border bg-vega-accent-soft px-3 py-2 lg:mx-4">
            <span className="mr-1 text-xs font-medium text-[#b58cff]">{selectedVisible.length} selected</span>
            <select defaultValue="" disabled={busy} onChange={(event) => { if (event.target.value) void runBulk({ status: event.target.value }); event.target.value = ""; }} className={selectClass} aria-label="Set status"><option value="">Set status</option>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select>
            <select defaultValue="" disabled={busy} onChange={(event) => { if (event.target.value) void runBulk({ priority: event.target.value }); event.target.value = ""; }} className={selectClass} aria-label="Set priority"><option value="">Set priority</option>{PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{humanize(priority)}</option>)}</select>
            {canAssignOthers ? <select defaultValue="" disabled={busy} onChange={(event) => { if (event.target.value) void runBulk({ assignedToUserId: event.target.value }); event.target.value = ""; }} className={selectClass} aria-label="Assign selected tasks"><option value="">Assign to</option>{assignableUsers.map((user) => <option key={user._id} value={user._id}>{user.fullName}</option>)}</select> : null}
            <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        ) : null}

        <div className="hidden overflow-x-auto border-t border-vega-border-soft md:block">
          <table className="w-full min-w-[980px] table-fixed text-left text-xs">
            <thead className="bg-[#0b151f] text-[10px] uppercase text-vega-text-muted"><tr><th className="w-10 px-3 py-2.5"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} disabled={!visibleIds.length} aria-label="Select all tasks" className="h-3.5 w-3.5 accent-[#7c3aed]" /></th><th className="w-[27%] px-3 py-2.5 font-medium">Task</th><th className="w-[14%] px-3 py-2.5 font-medium">Project</th><th className="w-[15%] px-3 py-2.5 font-medium">Assignee</th><th className="w-[13%] px-3 py-2.5 font-medium">Status</th><th className="w-[10%] px-3 py-2.5 font-medium">Priority</th><th className="w-[11%] px-3 py-2.5 font-medium">Due</th><th className="w-[10%] px-3 py-2.5 font-medium">Progress</th><th className="w-12 px-3 py-2.5" /></tr></thead>
            <tbody>{loading ? <TableSkeleton /> : filtered.map((task) => <DesktopTaskRow key={task._id} task={task} selected={selected.has(task._id)} openMenu={openMenuId === task._id} busy={busy} onToggle={() => toggleOne(task._id)} onMenu={() => setOpenMenuId(openMenuId === task._id ? null : task._id)} onDuplicate={() => void duplicateTask(task._id)} onArchive={() => void archiveTask(task._id)} />)}</tbody>
          </table>
        </div>

        <div className="space-y-2.5 border-t border-vega-border-soft p-3 md:hidden">{loading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-48 animate-pulse rounded-md bg-vega-surface-2" />) : filtered.map((task) => <MobileTaskCard key={task._id} task={task} selected={selected.has(task._id)} openMenu={openMenuId === task._id} busy={busy} onToggle={() => toggleOne(task._id)} onMenu={() => setOpenMenuId(openMenuId === task._id ? null : task._id)} onDuplicate={() => void duplicateTask(task._id)} onArchive={() => void archiveTask(task._id)} />)}</div>

        {!loading && filtered.length === 0 ? <div className="border-t border-vega-border-soft px-4 py-12 text-center"><ListChecks className="mx-auto h-7 w-7 text-vega-text-dim" /><p className="mt-3 text-sm font-medium text-vega-text">No tasks found</p><p className="mt-1 text-xs text-vega-text-muted">{hasFilters ? "Try clearing your current filters." : "Create a task to start tracking work."}</p>{hasFilters ? <Button variant="secondary" className="mt-4" onClick={clearFilters}>Clear filters</Button> : <Button className="mt-4" onClick={onCreateTask}><Plus className="mr-2 h-4 w-4" />New task</Button>}</div> : null}

        {!loading && filtered.length > 0 ? <div className="flex items-center justify-between border-t border-vega-border-soft px-4 py-3"><p className="text-[11px] text-vega-text-muted">Showing {filtered.length} of {tasks.length} tasks</p><button type="button" onClick={() => void onRefresh()} className="text-[11px] font-medium text-vega-accent hover:text-[#b58cff]">Refresh</button></div> : null}
      </section>
    </div>
  );
}

function SummaryTile({ label, value, helper, icon: Icon, tone }: { label: string; value: number; helper: string; icon: typeof ListChecks; tone: string }) {
  return <div className={cn(panelClass, "flex min-h-[92px] items-center gap-3 p-3.5 lg:px-4")}><span className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md", tone)}><Icon className="h-5 w-5" strokeWidth={1.8} /></span><div className="min-w-0"><p className="text-[11px] text-vega-text-muted">{label}</p><p className="mt-0.5 text-xl font-semibold leading-none text-vega-text">{value}</p><p className="mt-1.5 truncate text-[9px] text-vega-text-dim">{helper}</p></div></div>;
}

function DesktopTaskRow({ task, selected, openMenu, busy, onToggle, onMenu, onDuplicate, onArchive }: { task: WorkspaceTask; selected: boolean; openMenu: boolean; busy: boolean; onToggle: () => void; onMenu: () => void; onDuplicate: () => void; onArchive: () => void }) {
  const status = normalizeTaskStatus(task.status);
  const priority = task.priority ?? "MEDIUM";
  const project = projectOf(task.projectId);
  const assignee = displayName(task.assignedToUserId);
  const due = dueLabel(task.dueAt, task.status);
  const progress = Math.min(100, Math.max(0, task.progressPercent ?? 0));
  return <tr className={cn("border-t border-vega-border-soft transition-colors", selected ? "bg-vega-surface-selected" : "hover:bg-vega-surface-hover/50")}><td className="px-3 py-2.5"><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${task.title}`} className="h-3.5 w-3.5 accent-[#7c3aed]" /></td><td className="px-3 py-2.5"><Link href={`/tasks/${task._id}`} className="block truncate font-semibold text-vega-text hover:text-[#b58cff]">{task.title}</Link><div className="mt-1 flex items-center gap-2 text-[9px] text-vega-text-muted"><span className="font-mono">{task.code ?? "No code"}</span>{task.subtaskCount ? <span>{task.subtaskCompletedCount ?? 0}/{task.subtaskCount} subtasks</span> : null}{task.dependencyCount ? <span className="inline-flex items-center gap-1"><Link2 className="h-2.5 w-2.5" />{task.dependencyCount}</span> : null}</div></td><td className="truncate px-3 py-2.5 text-vega-text-secondary">{project?.title ?? "No project"}</td><td className="px-3 py-2.5"><div className="flex items-center gap-2"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#293852] text-[9px] font-semibold text-[#d8e2ef]">{initialsOf(assignee)}</span><span className="truncate text-vega-text-secondary">{assignee}</span></div></td><td className="px-3 py-2.5"><span className={cn("inline-flex h-[22px] items-center rounded-md border px-2 text-[9px] font-medium", statusTone(task.status))}>{humanize(status)}</span></td><td className="px-3 py-2.5"><span className={cn("inline-flex h-[22px] items-center rounded-md border px-2 text-[9px] font-medium", priorityTone(priority))}>{humanize(priority)}</span></td><td className={cn("whitespace-nowrap px-3 py-2.5 text-[11px]", due.tone)}>{due.text}</td><td className="px-3 py-2.5"><div className="flex items-center gap-2"><span className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-sm bg-vega-surface-2"><span className={cn("block h-full rounded-sm", progressTone(task.status))} style={{ width: `${progress}%` }} /></span><span className="text-[9px] text-vega-text-muted">{progress}%</span></div></td><td className="relative px-3 py-2.5 text-right"><TaskMenu task={task} open={openMenu} busy={busy} onMenu={onMenu} onDuplicate={onDuplicate} onArchive={onArchive} /></td></tr>;
}

function MobileTaskCard({ task, selected, openMenu, busy, onToggle, onMenu, onDuplicate, onArchive }: { task: WorkspaceTask; selected: boolean; openMenu: boolean; busy: boolean; onToggle: () => void; onMenu: () => void; onDuplicate: () => void; onArchive: () => void }) {
  const status = normalizeTaskStatus(task.status);
  const priority = task.priority ?? "MEDIUM";
  const project = projectOf(task.projectId);
  const assignee = displayName(task.assignedToUserId);
  const due = dueLabel(task.dueAt, task.status);
  const progress = Math.min(100, Math.max(0, task.progressPercent ?? 0));
  return <article className={cn("relative rounded-md border p-3", selected ? "border-vega-accent bg-vega-accent-soft" : "border-vega-border bg-[#0b151f]")}><div className="flex items-start gap-3"><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${task.title}`} className="mt-1 h-4 w-4 shrink-0 accent-[#7c3aed]" /><div className="min-w-0 flex-1"><Link href={`/tasks/${task._id}`} className="line-clamp-2 text-sm font-semibold leading-5 text-vega-text">{task.title}</Link><p className="mt-0.5 truncate text-[10px] text-vega-text-muted">{task.code ?? "No code"}{project ? ` · ${project.title}` : ""}</p></div><TaskMenu task={task} open={openMenu} busy={busy} onMenu={onMenu} onDuplicate={onDuplicate} onArchive={onArchive} /></div><div className="mt-3 flex flex-wrap items-center gap-2"><span className={cn("rounded-md border px-2 py-1 text-[10px] font-medium", statusTone(task.status))}>{humanize(status)}</span><span className={cn("rounded-md border px-2 py-1 text-[10px] font-medium", priorityTone(priority))}>{humanize(priority)}</span><span className={cn("ml-auto inline-flex items-center gap-1 text-[10px]", due.tone)}><Clock3 className="h-3.5 w-3.5" />{due.text}</span></div><div className="mt-3 grid grid-cols-2 gap-3 border-t border-vega-border-soft pt-3"><div className="flex min-w-0 items-center gap-2"><span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#293852] text-[10px] font-semibold">{initialsOf(assignee)}</span><div className="min-w-0"><p className="text-[9px] text-vega-text-muted">Assignee</p><p className="truncate text-[11px] text-vega-text-secondary">{assignee}</p></div></div><div className="min-w-0 border-l border-vega-border-soft pl-3"><p className="text-[9px] text-vega-text-muted">Progress</p><div className="mt-1.5 flex items-center gap-2"><span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-vega-surface-2"><span className={cn("block h-full rounded-sm", progressTone(task.status))} style={{ width: `${progress}%` }} /></span><span className="text-[9px] text-vega-text-muted">{progress}%</span></div></div></div><div className="mt-3 grid grid-cols-2 gap-2"><Link href={`/tasks/${task._id}`} className="inline-flex h-9 items-center justify-center rounded-md border border-vega-border bg-vega-surface-1 text-xs font-medium text-vega-text-secondary">Open task<ChevronRight className="ml-1 h-4 w-4" /></Link><div className="flex h-9 items-center justify-center gap-2 rounded-md border border-vega-border bg-vega-surface-1 text-[10px] text-vega-text-muted">{task.subtaskCount ? <><ListChecks className="h-3.5 w-3.5" />{task.subtaskCompletedCount ?? 0}/{task.subtaskCount} subtasks</> : <><FolderKanban className="h-3.5 w-3.5" />No subtasks</>}</div></div></article>;
}

function TaskMenu({ task, open, busy, onMenu, onDuplicate, onArchive }: { task: WorkspaceTask; open: boolean; busy: boolean; onMenu: () => void; onDuplicate: () => void; onArchive: () => void }) {
  return <div className="relative shrink-0"><button type="button" onClick={onMenu} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-vega-text-muted hover:bg-vega-surface-hover" aria-label={`Actions for ${task.title}`}><MoreHorizontal className="h-4 w-4" /></button>{open ? <div className="absolute right-0 top-9 z-40 w-40 overflow-hidden rounded-md border border-vega-border bg-[#08121c] p-1 shadow-2xl"><Link href={`/tasks/${task._id}`} className="flex items-center gap-2 rounded px-2.5 py-2 text-xs text-vega-text-secondary hover:bg-vega-surface-hover"><ChevronRight className="h-3.5 w-3.5" />Open task</Link><button type="button" disabled={busy} onClick={onDuplicate} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-xs text-vega-text-secondary hover:bg-vega-surface-hover disabled:opacity-50"><Copy className="h-3.5 w-3.5" />Duplicate</button><button type="button" disabled={busy} onClick={onArchive} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-xs text-vega-red hover:bg-vega-red/10 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Archive</button></div> : null}</div>;
}

function TableSkeleton() {
  return <>{Array.from({ length: 6 }).map((_, index) => <tr key={index} className="border-t border-vega-border-soft"><td className="px-3 py-3"><div className="h-3.5 w-3.5 rounded bg-vega-surface-2" /></td><td className="px-3 py-3"><div className="h-3 w-44 rounded bg-vega-surface-2" /><div className="mt-2 h-2 w-20 rounded bg-vega-surface-2" /></td>{Array.from({ length: 7 }).map((__, cell) => <td key={cell} className="px-3 py-3"><div className="h-3 w-14 rounded bg-vega-surface-2" /></td>)}</tr>)}</>;
}

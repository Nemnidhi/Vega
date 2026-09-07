"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Plus,
  Target,
  X,
} from "lucide-react";
import { TasksWorkspace, type WorkspaceTask } from "@/components/tasks/tasks-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";

const TaskAnalyticsPanel = dynamic(
  () => import("@/components/tasks/task-analytics-panel").then((module) => module.TaskAnalyticsPanel),
  {
    ssr: false,
    loading: () => <div className="flex h-[320px] items-center justify-center rounded-lg border border-vega-border bg-vega-surface-1 text-xs text-vega-text-muted">Loading analytics...</div>,
  },
);

type PopulatedUser = { _id: string; fullName: string; email: string; role: string };
type TaskStatus = "todo" | "in_progress" | "done";
type WorkflowTemplate = "custom" | "client_delivery" | "lead_to_delivery" | "marketing_campaign" | "n8n_automation";
type ActiveTab = "tasks" | "calendar" | "analytics" | "kpis";
type KpiPeriod = "weekly" | "monthly" | "quarterly" | "yearly";

type TaskFlowStep = { key: string; title: string; status: TaskStatus; order: number };
type Task = WorkspaceTask & {
  description: string;
  assignedToUserId: PopulatedUser | string;
  createdBy: PopulatedUser | string;
  kpiId: string | null;
  workflowTemplate: WorkflowTemplate;
  flowSteps: TaskFlowStep[];
};
type Kpi = {
  _id: string;
  title: string;
  description: string;
  target: number;
  period: KpiPeriod;
  periodStart: string;
  periodEnd: string;
  assignedRole: string | null;
  assignedUserId: PopulatedUser | string | null;
  progress: { completed: number; target: number; progress: number };
};
type TaskFormState = { title: string; description: string; dueAt: string; assignedToUserId: string; kpiId: string; priority: string };

const ASSIGNABLE_ROLES = ["admin", "partner", "sales", "digital_marketing", "project_manager", "developer"] as const;
const MANAGE_KPI_ROLES = ["admin", "partner", "project_manager"];
const ASSIGN_OTHERS_ROLES = ["admin", "partner", "project_manager"];
const selectClass = "h-[38px] w-full rounded-md border border-vega-border bg-[#0b141f] px-3 text-xs text-vega-text outline-none focus:border-vega-accent/70";
const panelClass = "rounded-lg border border-vega-border bg-vega-surface-1";

const TABS: Array<{ key: ActiveTab; label: string; icon: typeof ClipboardCheck }> = [
  { key: "tasks", label: "Tasks", icon: ClipboardCheck },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "kpis", label: "KPIs", icon: Target },
];

function displayName(user: PopulatedUser | string | null | undefined) {
  if (!user) return "Unassigned";
  return typeof user === "string" ? user : user.fullName || user.email;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildMonthGrid(visibleMonth: Date, tasksByDateKey: Map<string, Task[]>) {
  const monthStart = startOfMonth(visibleMonth);
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - monthStart.getDay());
  const todayKey = toDateKey(new Date());
  return Array.from({ length: 42 }, (_, offset) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + offset);
    const dateKey = toDateKey(date);
    return { date, dateKey, inCurrentMonth: date.getMonth() === monthStart.getMonth(), isToday: dateKey === todayKey, tasks: tasksByDateKey.get(dateKey) ?? [] };
  });
}

async function callApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload?.error?.message ?? "Request failed.");
  return payload.data as T;
}

interface TasksViewProps {
  currentUserId: string;
  currentUserRole: string;
  initialTasks: Task[];
  initialKpis: Kpi[];
  assignableUsers: PopulatedUser[];
}

export function TasksView({ currentUserId, currentUserRole, initialTasks, initialKpis, assignableUsers }: TasksViewProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("tasks");
  const [createOpen, setCreateOpen] = useState(false);
  const [kpiCreateOpen, setKpiCreateOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [kpis, setKpis] = useState<Kpi[]>(initialKpis);
  const [error, setError] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const canAssignOthers = ASSIGN_OTHERS_ROLES.includes(currentUserRole);
  const canManageKpis = MANAGE_KPI_ROLES.includes(currentUserRole);

  const [taskForm, setTaskForm] = useState<TaskFormState>({ title: "", description: "", dueAt: "", assignedToUserId: currentUserId, kpiId: "", priority: "MEDIUM" });
  const [creatingTask, setCreatingTask] = useState(false);
  const [kpiForm, setKpiForm] = useState({ title: "", description: "", target: 10, period: "monthly" as KpiPeriod, periodStart: toDateKey(startOfMonth(new Date())), periodEnd: "", assignedRole: "", assignedUserId: "" });
  const [creatingKpi, setCreatingKpi] = useState(false);

  const refreshTasks = useCallback(async () => {
    try {
      const refreshed = await callApi<Task[]>(canAssignOthers ? "/api/tasks?all=1" : "/api/tasks");
      setTasks(refreshed);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not refresh tasks.");
    }
  }, [canAssignOthers]);

  const tasksByDateKey = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueAt) continue;
      const key = toDateKey(new Date(task.dueAt));
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    return map;
  }, [tasks]);
  const monthGrid = useMemo(() => buildMonthGrid(visibleMonth, tasksByDateKey), [tasksByDateKey, visibleMonth]);
  const undatedTasks = tasks.filter((task) => !task.dueAt && task.status !== "done");

  async function handleCreateTask(event: React.FormEvent) {
    event.preventDefault();
    if (!taskForm.title.trim()) return setError("Task title is required.");
    setCreatingTask(true);
    setError("");
    try {
      const created = await callApi<Task>("/api/tasks", { method: "POST", body: JSON.stringify({ title: taskForm.title, description: taskForm.description || undefined, dueAt: taskForm.dueAt || undefined, priority: taskForm.priority, assignedToUserId: canAssignOthers ? taskForm.assignedToUserId : undefined, kpiId: taskForm.kpiId || undefined }) });
      setTasks((current) => [created, ...current]);
      setTaskForm({ title: "", description: "", dueAt: "", assignedToUserId: currentUserId, kpiId: "", priority: "MEDIUM" });
      setCreateOpen(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create task.");
    } finally {
      setCreatingTask(false);
    }
  }

  async function handleCreateKpi(event: React.FormEvent) {
    event.preventDefault();
    if (!kpiForm.title.trim() || !kpiForm.periodEnd) return setError("KPI title and end date are required.");
    if (!kpiForm.assignedRole && !kpiForm.assignedUserId) return setError("A KPI needs a role, a person, or both.");
    setCreatingKpi(true);
    setError("");
    try {
      const created = await callApi<Kpi>("/api/kpis", { method: "POST", body: JSON.stringify({ title: kpiForm.title, description: kpiForm.description || undefined, target: Number(kpiForm.target), period: kpiForm.period, periodStart: kpiForm.periodStart, periodEnd: kpiForm.periodEnd, assignedRole: kpiForm.assignedRole || undefined, assignedUserId: kpiForm.assignedUserId || undefined }) });
      setKpis((current) => [created, ...current]);
      setKpiForm({ title: "", description: "", target: 10, period: "monthly", periodStart: toDateKey(startOfMonth(new Date())), periodEnd: "", assignedRole: "", assignedUserId: "" });
      setKpiCreateOpen(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create KPI.");
    } finally {
      setCreatingKpi(false);
    }
  }

  return (
    <section className="min-w-0">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div><p className="text-[11px] text-vega-text-muted">Team / Tasks</p><h1 className="mt-1 text-[26px] font-semibold leading-8 text-vega-text lg:text-[28px]">Tasks</h1><p className="mt-1 text-xs text-vega-text-muted lg:text-sm">Plan work, manage ownership and keep delivery moving.</p></div>
        <div className="shrink-0">{activeTab === "kpis" && canManageKpis ? <Button size="lg" onClick={() => setKpiCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />New KPI</Button> : <Button size="lg" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /><span className="hidden sm:inline">Create task</span><span className="sm:hidden">Task</span></Button>}</div>
      </header>

      <div className="mb-4 grid grid-cols-4 overflow-hidden rounded-lg border border-vega-border bg-vega-surface-1 lg:max-w-[560px]">
        {TABS.map(({ key, label, icon: Icon }) => <button key={key} type="button" onClick={() => setActiveTab(key)} className={cn("flex h-11 items-center justify-center gap-2 border-r border-vega-border text-[11px] font-medium last:border-r-0 sm:text-xs", activeTab === key ? "bg-vega-accent text-white" : "text-vega-text-muted hover:bg-vega-surface-hover hover:text-vega-text")}><Icon className="h-4 w-4" /><span>{label}</span></button>)}
      </div>

      {error ? <div className="mb-4 flex items-center justify-between rounded-md border border-vega-red/30 bg-vega-red/10 px-3 py-2 text-xs text-vega-red"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X className="h-4 w-4" /></button></div> : null}

      {activeTab === "tasks" ? <TasksWorkspace tasks={tasks} currentUserId={currentUserId} canAssignOthers={canAssignOthers} assignableUsers={assignableUsers} onRefresh={refreshTasks} onCreateTask={() => setCreateOpen(true)} /> : null}
      {activeTab === "calendar" ? <CalendarWorkspace visibleMonth={visibleMonth} setVisibleMonth={setVisibleMonth} monthGrid={monthGrid} undatedCount={undatedTasks.length} /> : null}
      {activeTab === "analytics" ? <TaskAnalyticsPanel assignableUsers={assignableUsers} currentUserId={currentUserId} currentUserRole={currentUserRole} /> : null}
      {activeTab === "kpis" ? <KpiWorkspace kpis={kpis} canManage={canManageKpis} onCreate={() => setKpiCreateOpen(true)} /> : null}

      {createOpen ? <TaskDialog taskForm={taskForm} setTaskForm={setTaskForm} currentUserId={currentUserId} canAssignOthers={canAssignOthers} assignableUsers={assignableUsers} kpis={kpis} creating={creatingTask} onClose={() => setCreateOpen(false)} onSubmit={handleCreateTask} /> : null}
      {kpiCreateOpen ? <KpiDialog form={kpiForm} setForm={setKpiForm} users={assignableUsers} creating={creatingKpi} onClose={() => setKpiCreateOpen(false)} onSubmit={handleCreateKpi} /> : null}
    </section>
  );
}

function CalendarWorkspace({ visibleMonth, setVisibleMonth, monthGrid, undatedCount }: { visibleMonth: Date; setVisibleMonth: React.Dispatch<React.SetStateAction<Date>>; monthGrid: ReturnType<typeof buildMonthGrid>; undatedCount: number }) {
  return <section className={cn(panelClass, "overflow-hidden")}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-vega-border px-4 py-3"><div><h2 className="text-base font-semibold text-vega-text">{visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2><p className="mt-0.5 text-[10px] text-vega-text-muted">Tasks grouped by due date</p></div><div className="flex gap-2"><button type="button" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-vega-border text-vega-text-secondary hover:bg-vega-surface-hover" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button><Button variant="secondary" onClick={() => setVisibleMonth(startOfMonth(new Date()))}>Today</Button><button type="button" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-vega-border text-vega-text-secondary hover:bg-vega-surface-hover" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button></div></div><div className="grid grid-cols-7 border-b border-vega-border bg-[#0b151f] text-center text-[9px] font-medium uppercase text-vega-text-muted sm:text-[10px]">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-2 sm:py-2.5">{day}</div>)}</div><div className="grid grid-cols-7">{monthGrid.map((cell) => <div key={cell.dateKey} className={cn("relative min-h-[64px] border-b border-r border-vega-border-soft p-1.5 sm:min-h-[105px] sm:p-2", !cell.inCurrentMonth && "bg-[#0a131d] text-vega-text-dim", cell.isToday && "bg-vega-accent-soft")}><span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium sm:text-xs", cell.isToday ? "bg-vega-accent text-white" : "text-vega-text-secondary")}>{cell.date.getDate()}</span><div className="mt-1 space-y-1">{cell.tasks.slice(0, 3).map((task) => <Link key={task._id} href={`/tasks/${task._id}`} title={task.title} className="block truncate rounded-sm bg-vega-blue-soft px-1.5 py-1 text-[8px] text-[#8fc3ff] sm:text-[9px]"><span className="sm:hidden">Task</span><span className="hidden sm:inline">{task.title}</span></Link>)}{cell.tasks.length > 3 ? <p className="text-[8px] text-vega-text-muted">+{cell.tasks.length - 3} more</p> : null}</div></div>)}</div><div className="flex items-center justify-between px-4 py-3 text-[10px] text-vega-text-muted"><span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-vega-blue" />Task due date</span>{undatedCount ? <span>{undatedCount} without a due date</span> : null}</div></section>;
}

function KpiWorkspace({ kpis, canManage, onCreate }: { kpis: Kpi[]; canManage: boolean; onCreate: () => void }) {
  const complete = kpis.filter((kpi) => kpi.progress.progress >= 1).length;
  const average = kpis.length ? Math.round(kpis.reduce((sum, kpi) => sum + Math.min(1, kpi.progress.progress), 0) / kpis.length * 100) : 0;
  return <div className="space-y-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-3"><MiniMetric label="Active KPIs" value={kpis.length} icon={Target} tone="text-[#a98bff]" /><MiniMetric label="Targets met" value={complete} icon={CheckCircle2} tone="text-[#58e18b]" /><div className="col-span-2 lg:col-span-1"><MiniMetric label="Average progress" value={`${average}%`} icon={BarChart3} tone="text-[#62b0ff]" /></div></div><section className={cn(panelClass, "overflow-hidden")}><div className="border-b border-vega-border px-4 py-3"><h2 className="text-base font-semibold text-vega-text">Performance targets</h2><p className="mt-0.5 text-[10px] text-vega-text-muted">Progress from completed linked tasks</p></div>{kpis.length ? <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">{kpis.map((kpi) => { const percent = Math.round(kpi.progress.progress * 100); return <article key={kpi._id} className="rounded-md border border-vega-border bg-[#0b151f] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-vega-text">{kpi.title}</h3><p className="mt-1 text-[10px] capitalize text-vega-text-muted">{kpi.period} target</p></div><span className="rounded-md bg-vega-accent-soft px-2 py-1 text-[10px] text-[#b58cff]">{percent}%</span></div>{kpi.description ? <p className="mt-3 line-clamp-2 text-[11px] leading-4 text-vega-text-muted">{kpi.description}</p> : null}<div className="mt-4 flex items-end justify-between"><div><p className="text-xl font-semibold text-vega-text">{kpi.progress.completed} <span className="text-xs font-normal text-vega-text-muted">/ {kpi.progress.target}</span></p><p className="text-[9px] text-vega-text-dim">Tasks completed</p></div><p className="max-w-[45%] truncate text-right text-[10px] text-vega-text-muted">{kpi.assignedUserId ? displayName(kpi.assignedUserId) : kpi.assignedRole ?? "Team"}</p></div><div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-vega-surface-2"><div className={cn("h-full rounded-sm", percent >= 100 ? "bg-vega-green" : "bg-vega-accent")} style={{ width: `${Math.min(100, percent)}%` }} /></div><p className="mt-3 text-[9px] text-vega-text-dim">{new Date(kpi.periodStart).toLocaleDateString()} - {new Date(kpi.periodEnd).toLocaleDateString()}</p></article>; })}</div> : <div className="px-4 py-12 text-center"><Target className="mx-auto h-7 w-7 text-vega-text-dim" /><p className="mt-3 text-sm font-medium text-vega-text">No KPIs yet</p>{canManage ? <Button className="mt-4" onClick={onCreate}>Create first KPI</Button> : null}</div>}</section></div>;
}

function MiniMetric({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Target; tone: string }) {
  return <div className={cn(panelClass, "flex min-h-[82px] items-center gap-3 p-4")}><Icon className={cn("h-6 w-6", tone)} /><div><p className="text-[10px] text-vega-text-muted">{label}</p><p className="mt-1 text-xl font-semibold leading-none text-vega-text">{value}</p></div></div>;
}

function TaskDialog({ taskForm, setTaskForm, currentUserId, canAssignOthers, assignableUsers, kpis, creating, onClose, onSubmit }: { taskForm: TaskFormState; setTaskForm: React.Dispatch<React.SetStateAction<TaskFormState>>; currentUserId: string; canAssignOthers: boolean; assignableUsers: PopulatedUser[]; kpis: Kpi[]; creating: boolean; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Create task"><form onSubmit={onSubmit} className={cn(panelClass, "max-h-[92dvh] w-full max-w-xl overflow-y-auto bg-[#09131d] shadow-2xl")}><div className="flex items-center justify-between border-b border-vega-border px-4 py-3"><div><h2 className="text-base font-semibold text-vega-text">Create task</h2><p className="mt-0.5 text-[10px] text-vega-text-muted">Add the essentials now. Workflow details can be added after creation.</p></div><button type="button" onClick={onClose} disabled={creating} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-vega-text-muted hover:bg-vega-surface-hover" aria-label="Close"><X className="h-4 w-4" /></button></div><div className="grid gap-3 p-4 sm:grid-cols-2"><label className="text-[11px] text-vega-text-muted sm:col-span-2">Task title<Input autoFocus required value={taskForm.title} onChange={(event) => setTaskForm((form) => ({ ...form, title: event.target.value }))} placeholder="What needs to be done?" className="mt-1 h-[38px]" /></label><label className="text-[11px] text-vega-text-muted sm:col-span-2">Description<Textarea value={taskForm.description} onChange={(event) => setTaskForm((form) => ({ ...form, description: event.target.value }))} placeholder="Add context, expected outcome or links..." className="mt-1 min-h-20" /></label><label className="text-[11px] text-vega-text-muted">Due date<Input type="date" value={taskForm.dueAt} onChange={(event) => setTaskForm((form) => ({ ...form, dueAt: event.target.value }))} className="mt-1 h-[38px]" /></label><label className="text-[11px] text-vega-text-muted">Priority<select value={taskForm.priority} onChange={(event) => setTaskForm((form) => ({ ...form, priority: event.target.value }))} className={cn(selectClass, "mt-1")}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label>{canAssignOthers ? <label className="text-[11px] text-vega-text-muted">Assignee<select value={taskForm.assignedToUserId} onChange={(event) => setTaskForm((form) => ({ ...form, assignedToUserId: event.target.value }))} className={cn(selectClass, "mt-1")}><option value={currentUserId}>Myself</option>{assignableUsers.filter((user) => user._id !== currentUserId).map((user) => <option key={user._id} value={user._id}>{user.fullName}</option>)}</select></label> : null}{kpis.length ? <label className="text-[11px] text-vega-text-muted">Linked KPI<select value={taskForm.kpiId} onChange={(event) => setTaskForm((form) => ({ ...form, kpiId: event.target.value }))} className={cn(selectClass, "mt-1")}><option value="">No linked KPI</option>{kpis.map((kpi) => <option key={kpi._id} value={kpi._id}>{kpi.title}</option>)}</select></label> : null}</div><div className="grid grid-cols-2 gap-2 border-t border-vega-border px-4 py-3"><Button type="button" variant="secondary" onClick={onClose} disabled={creating}>Cancel</Button><Button type="submit" disabled={creating || !taskForm.title.trim()}>{creating ? "Creating..." : "Create task"}</Button></div></form></div>;
}

function KpiDialog({ form, setForm, users, creating, onClose, onSubmit }: { form: { title: string; description: string; target: number; period: KpiPeriod; periodStart: string; periodEnd: string; assignedRole: string; assignedUserId: string }; setForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; target: number; period: KpiPeriod; periodStart: string; periodEnd: string; assignedRole: string; assignedUserId: string }>>; users: PopulatedUser[]; creating: boolean; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Create KPI"><form onSubmit={onSubmit} className={cn(panelClass, "max-h-[92dvh] w-full max-w-xl overflow-y-auto bg-[#09131d] shadow-2xl")}><div className="flex items-center justify-between border-b border-vega-border px-4 py-3"><div><h2 className="text-base font-semibold text-vega-text">Create KPI</h2><p className="mt-0.5 text-[10px] text-vega-text-muted">Set a measurable target for a person or team.</p></div><button type="button" onClick={onClose} disabled={creating} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-vega-text-muted hover:bg-vega-surface-hover" aria-label="Close"><X className="h-4 w-4" /></button></div><div className="grid gap-3 p-4 sm:grid-cols-2"><label className="text-[11px] text-vega-text-muted sm:col-span-2">KPI title<Input autoFocus required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-1 h-[38px]" placeholder="Example: Proposals sent" /></label><label className="text-[11px] text-vega-text-muted sm:col-span-2">Description<Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-1 min-h-16" /></label><label className="text-[11px] text-vega-text-muted">Target<Input type="number" min={1} value={form.target} onChange={(event) => setForm((current) => ({ ...current, target: Number(event.target.value) }))} className="mt-1 h-[38px]" /></label><label className="text-[11px] text-vega-text-muted">Period<select value={form.period} onChange={(event) => setForm((current) => ({ ...current, period: event.target.value as KpiPeriod }))} className={cn(selectClass, "mt-1")}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></label><label className="text-[11px] text-vega-text-muted">Starts<Input type="date" value={form.periodStart} onChange={(event) => setForm((current) => ({ ...current, periodStart: event.target.value }))} className="mt-1 h-[38px]" /></label><label className="text-[11px] text-vega-text-muted">Ends<Input required type="date" value={form.periodEnd} onChange={(event) => setForm((current) => ({ ...current, periodEnd: event.target.value }))} className="mt-1 h-[38px]" /></label><label className="text-[11px] text-vega-text-muted">Team role<select value={form.assignedRole} onChange={(event) => setForm((current) => ({ ...current, assignedRole: event.target.value }))} className={cn(selectClass, "mt-1")}><option value="">No role target</option>{ASSIGNABLE_ROLES.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select></label><label className="text-[11px] text-vega-text-muted">Individual<select value={form.assignedUserId} onChange={(event) => setForm((current) => ({ ...current, assignedUserId: event.target.value }))} className={cn(selectClass, "mt-1")}><option value="">No individual target</option>{users.map((user) => <option key={user._id} value={user._id}>{user.fullName}</option>)}</select></label></div><div className="grid grid-cols-2 gap-2 border-t border-vega-border px-4 py-3"><Button type="button" variant="secondary" onClick={onClose} disabled={creating}>Cancel</Button><Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create KPI"}</Button></div></form></div>;
}

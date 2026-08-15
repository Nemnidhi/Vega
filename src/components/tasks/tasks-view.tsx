"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PopulatedUser = { _id: string; fullName: string; email: string; role: string };

type TaskStatus = "todo" | "in_progress" | "done";

type Task = {
  _id: string;
  title: string;
  description: string;
  status: TaskStatus;
  dueAt: string | null;
  assignedToUserId: PopulatedUser | string;
  createdBy: PopulatedUser | string;
  kpiId: string | null;
};

type KpiPeriod = "weekly" | "monthly" | "quarterly" | "yearly";

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

const ASSIGNABLE_ROLES = ["admin", "partner", "sales", "digital_marketing", "project_manager", "developer"] as const;
const MANAGE_KPI_ROLES = ["admin", "partner", "project_manager"];
const ASSIGN_OTHERS_ROLES = ["admin", "partner", "project_manager"];

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const STATUS_VARIANT: Record<TaskStatus, "neutral" | "accent" | "success"> = {
  todo: "neutral",
  in_progress: "accent",
  done: "success",
};

function displayName(user: PopulatedUser | string | null | undefined) {
  if (!user) return "Unassigned";
  if (typeof user === "string") return user;
  return user.fullName || user.email;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildMonthGrid(visibleMonth: Date, tasksByDateKey: Map<string, Task[]>) {
  const currentMonthStart = startOfMonth(visibleMonth);
  const gridStart = new Date(currentMonthStart);
  gridStart.setDate(1 - currentMonthStart.getDay());
  const todayKey = toDateKey(new Date());

  return Array.from({ length: 42 }, (_, offset) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + offset);
    const dateKey = toDateKey(date);
    return {
      date,
      dateKey,
      inCurrentMonth: date.getMonth() === currentMonthStart.getMonth(),
      isToday: dateKey === todayKey,
      tasks: tasksByDateKey.get(dateKey) ?? [],
    };
  });
}

async function callApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload?.error?.message ?? "Request failed.");
  }
  return payload.data as T;
}

interface TasksViewProps {
  currentUserId: string;
  currentUserRole: string;
  initialTasks: Task[];
  initialKpis: Kpi[];
  assignableUsers: PopulatedUser[];
}

export function TasksView({
  currentUserId,
  currentUserRole,
  initialTasks,
  initialKpis,
  assignableUsers,
}: TasksViewProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "calendar" | "kpis">("tasks");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [kpis, setKpis] = useState<Kpi[]>(initialKpis);
  const [error, setError] = useState("");
  const [busyTaskId, setBusyTaskId] = useState("");

  const canAssignOthers = ASSIGN_OTHERS_ROLES.includes(currentUserRole);
  const canManageKpis = MANAGE_KPI_ROLES.includes(currentUserRole);

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    dueAt: "",
    assignedToUserId: currentUserId,
    kpiId: "",
  });
  const [creatingTask, setCreatingTask] = useState(false);

  const [kpiForm, setKpiForm] = useState({
    title: "",
    description: "",
    target: 10,
    period: "monthly" as KpiPeriod,
    periodStart: toDateKey(startOfMonth(new Date())),
    periodEnd: "",
    assignedRole: "",
    assignedUserId: "",
  });
  const [creatingKpi, setCreatingKpi] = useState(false);

  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));

  const tasksByDateKey = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueAt) continue;
      const key = toDateKey(new Date(task.dueAt));
      const entries = map.get(key) ?? [];
      entries.push(task);
      map.set(key, entries);
    }
    return map;
  }, [tasks]);

  const monthGrid = useMemo(() => buildMonthGrid(visibleMonth, tasksByDateKey), [visibleMonth, tasksByDateKey]);
  const undatedTasks = tasks.filter((task) => !task.dueAt && task.status !== "done");

  async function handleCreateTask(event: React.FormEvent) {
    event.preventDefault();
    if (!taskForm.title.trim()) {
      setError("Task title is required.");
      return;
    }
    setCreatingTask(true);
    setError("");
    try {
      const created = await callApi<Task>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: taskForm.title,
          description: taskForm.description || undefined,
          dueAt: taskForm.dueAt || undefined,
          assignedToUserId: canAssignOthers ? taskForm.assignedToUserId : undefined,
          kpiId: taskForm.kpiId || undefined,
        }),
      });
      setTasks((current) => [created, ...current]);
      setTaskForm({ title: "", description: "", dueAt: "", assignedToUserId: currentUserId, kpiId: "" });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create task.");
    } finally {
      setCreatingTask(false);
    }
  }

  async function toggleTaskDone(task: Task) {
    setBusyTaskId(task._id);
    setError("");
    try {
      const nextStatus: TaskStatus = task.status === "done" ? "todo" : "done";
      const updated = await callApi<Task>(`/api/tasks/${task._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setTasks((current) => current.map((item) => (item._id === task._id ? updated : item)));
      if (task.kpiId) {
        // Completing/reopening a linked task changes KPI progress - refetch KPIs rather than
        // trying to recompute the aggregate client-side.
        const refreshed = await callApi<Kpi[]>("/api/kpis");
        setKpis(refreshed);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not update task.");
    } finally {
      setBusyTaskId("");
    }
  }

  async function deleteTask(taskId: string) {
    setBusyTaskId(taskId);
    setError("");
    try {
      await callApi(`/api/tasks/${taskId}`, { method: "DELETE" });
      setTasks((current) => current.filter((item) => item._id !== taskId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete task.");
    } finally {
      setBusyTaskId("");
    }
  }

  async function handleCreateKpi(event: React.FormEvent) {
    event.preventDefault();
    if (!kpiForm.title.trim() || !kpiForm.periodEnd) {
      setError("KPI title and end date are required.");
      return;
    }
    if (!kpiForm.assignedRole && !kpiForm.assignedUserId) {
      setError("A KPI needs a role, a person, or both.");
      return;
    }
    setCreatingKpi(true);
    setError("");
    try {
      const created = await callApi<Kpi>("/api/kpis", {
        method: "POST",
        body: JSON.stringify({
          title: kpiForm.title,
          description: kpiForm.description || undefined,
          target: Number(kpiForm.target),
          period: kpiForm.period,
          periodStart: kpiForm.periodStart,
          periodEnd: kpiForm.periodEnd,
          assignedRole: kpiForm.assignedRole || undefined,
          assignedUserId: kpiForm.assignedUserId || undefined,
        }),
      });
      setKpis((current) => [created, ...current]);
      setKpiForm({
        title: "",
        description: "",
        target: 10,
        period: "monthly",
        periodStart: toDateKey(startOfMonth(new Date())),
        periodEnd: "",
        assignedRole: "",
        assignedUserId: "",
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create KPI.");
    } finally {
      setCreatingKpi(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border/70">
        {(["tasks", "calendar", "kpis"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              activeTab === tab
                ? "border-b-2 border-accent text-accent-strong"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "kpis" ? "KPIs" : tab}
          </button>
        ))}
      </div>

      {error && (
        <Card className="border-danger/35 bg-danger/5">
          <CardContent className="p-3 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {activeTab === "tasks" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>New task</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTask} className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Task title"
                  value={taskForm.title}
                  onChange={(event) => setTaskForm((form) => ({ ...form, title: event.target.value }))}
                  className="sm:col-span-2"
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={taskForm.description}
                  onChange={(event) => setTaskForm((form) => ({ ...form, description: event.target.value }))}
                  className="sm:col-span-2 min-h-20"
                />
                <Input
                  type="date"
                  value={taskForm.dueAt}
                  onChange={(event) => setTaskForm((form) => ({ ...form, dueAt: event.target.value }))}
                />
                {canAssignOthers ? (
                  <select
                    value={taskForm.assignedToUserId}
                    onChange={(event) => setTaskForm((form) => ({ ...form, assignedToUserId: event.target.value }))}
                    className="h-11 rounded-xl border border-border/90 bg-white/92 px-3.5 text-sm text-foreground"
                  >
                    <option value={currentUserId}>Myself</option>
                    {assignableUsers
                      .filter((user) => user._id !== currentUserId)
                      .map((user) => (
                        <option key={user._id} value={user._id}>
                          {user.fullName} ({user.role})
                        </option>
                      ))}
                  </select>
                ) : null}
                {kpis.length > 0 ? (
                  <select
                    value={taskForm.kpiId}
                    onChange={(event) => setTaskForm((form) => ({ ...form, kpiId: event.target.value }))}
                    className="h-11 rounded-xl border border-border/90 bg-white/92 px-3.5 text-sm text-foreground sm:col-span-2"
                  >
                    <option value="">Not linked to a KPI</option>
                    {kpis.map((kpi) => (
                      <option key={kpi._id} value={kpi._id}>
                        Counts toward: {kpi.title}
                      </option>
                    ))}
                  </select>
                ) : null}
                <Button type="submit" disabled={creatingTask} className="sm:col-span-2 justify-self-start">
                  {creatingTask ? "Adding..." : "Add task"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {tasks.length === 0 && (
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
            )}
            {tasks.map((task) => (
              <Card key={task._id}>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {task.title}
                      </span>
                      <Badge variant={STATUS_VARIANT[task.status]}>{STATUS_LABEL[task.status]}</Badge>
                      {task.dueAt ? (
                        <Badge variant="neutral">Due {new Date(task.dueAt).toLocaleDateString()}</Badge>
                      ) : null}
                    </div>
                    {task.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Assigned to {displayName(task.assignedToUserId)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busyTaskId === task._id}
                      onClick={() => toggleTaskDone(task)}
                    >
                      {task.status === "done" ? "Reopen" : "Mark done"}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busyTaskId === task._id}
                      onClick={() => deleteTask(task._id)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === "calendar" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                Prev
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setVisibleMonth(startOfMonth(new Date()))}>
                Today
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                Next
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="py-1">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((cell) => (
                <div
                  key={cell.dateKey}
                  className={`min-h-20 rounded-lg border p-1.5 text-left text-[11px] ${
                    cell.inCurrentMonth ? "border-border/70 bg-white/70" : "border-border/40 bg-muted/20 text-muted-foreground"
                  } ${cell.isToday ? "ring-2 ring-accent/60" : ""}`}
                >
                  <div className="font-semibold">{cell.date.getDate()}</div>
                  {cell.tasks.slice(0, 3).map((task) => (
                    <div
                      key={task._id}
                      className={`mt-0.5 truncate rounded px-1 py-0.5 ${
                        task.status === "done" ? "bg-success/15 text-success line-through" : "bg-accent/15 text-accent-strong"
                      }`}
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  ))}
                  {cell.tasks.length > 3 ? (
                    <div className="mt-0.5 text-muted-foreground">+{cell.tasks.length - 3} more</div>
                  ) : null}
                </div>
              ))}
            </div>
            {undatedTasks.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {undatedTasks.length} task{undatedTasks.length === 1 ? "" : "s"} without a due date not shown here.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "kpis" && (
        <div className="space-y-4">
          {canManageKpis && (
            <Card>
              <CardHeader>
                <CardTitle>New KPI</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateKpi} className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="KPI title, e.g. 'Proposals sent'"
                    value={kpiForm.title}
                    onChange={(event) => setKpiForm((form) => ({ ...form, title: event.target.value }))}
                    className="sm:col-span-2"
                  />
                  <Textarea
                    placeholder="Description (optional)"
                    value={kpiForm.description}
                    onChange={(event) => setKpiForm((form) => ({ ...form, description: event.target.value }))}
                    className="sm:col-span-2 min-h-16"
                  />
                  <Input
                    type="number"
                    min={1}
                    placeholder="Target (number of tasks)"
                    value={kpiForm.target}
                    onChange={(event) => setKpiForm((form) => ({ ...form, target: Number(event.target.value) }))}
                  />
                  <select
                    value={kpiForm.period}
                    onChange={(event) => setKpiForm((form) => ({ ...form, period: event.target.value as KpiPeriod }))}
                    className="h-11 rounded-xl border border-border/90 bg-white/92 px-3.5 text-sm text-foreground"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                  <Input
                    type="date"
                    value={kpiForm.periodStart}
                    onChange={(event) => setKpiForm((form) => ({ ...form, periodStart: event.target.value }))}
                  />
                  <Input
                    type="date"
                    value={kpiForm.periodEnd}
                    onChange={(event) => setKpiForm((form) => ({ ...form, periodEnd: event.target.value }))}
                  />
                  <select
                    value={kpiForm.assignedRole}
                    onChange={(event) => setKpiForm((form) => ({ ...form, assignedRole: event.target.value }))}
                    className="h-11 rounded-xl border border-border/90 bg-white/92 px-3.5 text-sm text-foreground"
                  >
                    <option value="">No role target</option>
                    {ASSIGNABLE_ROLES.map((role) => (
                      <option key={role} value={role}>Team-wide: {role}</option>
                    ))}
                  </select>
                  <select
                    value={kpiForm.assignedUserId}
                    onChange={(event) => setKpiForm((form) => ({ ...form, assignedUserId: event.target.value }))}
                    className="h-11 rounded-xl border border-border/90 bg-white/92 px-3.5 text-sm text-foreground"
                  >
                    <option value="">No individual target</option>
                    {assignableUsers.map((user) => (
                      <option key={user._id} value={user._id}>{user.fullName}</option>
                    ))}
                  </select>
                  <Button type="submit" disabled={creatingKpi} className="sm:col-span-2 justify-self-start">
                    {creatingKpi ? "Creating..." : "Create KPI"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {kpis.length === 0 && (
              <p className="text-sm text-muted-foreground">No KPIs set yet.</p>
            )}
            {kpis.map((kpi) => {
              const percent = Math.round(kpi.progress.progress * 100);
              return (
                <Card key={kpi._id}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{kpi.title}</span>
                      {kpi.assignedRole ? <Badge variant="accent">{kpi.assignedRole}</Badge> : null}
                      {kpi.assignedUserId ? <Badge variant="neutral">{displayName(kpi.assignedUserId)}</Badge> : null}
                      <Badge variant="neutral" className="capitalize">{kpi.period}</Badge>
                    </div>
                    {kpi.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{kpi.description}</p>
                    ) : null}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{kpi.progress.completed} / {kpi.progress.target} tasks done</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted/40">
                        <div
                          className={`h-full rounded-full ${percent >= 100 ? "bg-success" : "bg-accent"}`}
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {new Date(kpi.periodStart).toLocaleDateString()} - {new Date(kpi.periodEnd).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TasksWorkspace, type WorkspaceTask } from "@/components/tasks/tasks-workspace";
import dynamic from "next/dynamic";

// Analytics sits behind a tab and is not on the path most people take through this page.
const TaskAnalyticsPanel = dynamic(
  () => import("@/components/tasks/task-analytics-panel").then((m) => m.TaskAnalyticsPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[320px] items-center justify-center rounded-lg border border-vega-border bg-vega-surface-1">
        <p className="text-xs text-vega-text-muted">Loading analytics...</p>
      </div>
    ),
  },
);

type PopulatedUser = { _id: string; fullName: string; email: string; role: string };

type TaskStatus = "todo" | "in_progress" | "done";
type WorkflowTemplate = "custom" | "client_delivery" | "lead_to_delivery" | "marketing_campaign" | "n8n_automation";

type SubTask = {
  _id?: string;
  title: string;
  description: string;
  status: TaskStatus;
  dueAt: string | null;
  assignedToUserId: PopulatedUser | string | null;
  sourceSheet?: string;
  sourceRow?: number | null;
  order: number;
};

type TaskFlowStep = {
  key: string;
  title: string;
  status: TaskStatus;
  order: number;
};

type Task = {
  _id: string;
  title: string;
  description: string;
  status: TaskStatus;
  dueAt: string | null;
  assignedToUserId: PopulatedUser | string;
  createdBy: PopulatedUser | string;
  kpiId: string | null;
  workflowTemplate: WorkflowTemplate;
  flowSteps: TaskFlowStep[];
  subTasks: SubTask[];
  // Supplied by getTasksWorkspace. Optional so older callers still typecheck.
  code?: string | null;
  priority?: string;
  progressPercent?: number;
  stage?: string;
  projectId?: { _id: string; title: string; status?: string } | string | null;
  subtaskCount?: number;
  subtaskCompletedCount?: number;
  dependencyCount?: number;
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

type TaskFormState = {
  title: string;
  description: string;
  dueAt: string;
  assignedToUserId: string;
  kpiId: string;
  workflowTemplate: WorkflowTemplate;
  subTasks: SubTask[];
};

const ASSIGNABLE_ROLES = ["admin", "partner", "sales", "digital_marketing", "project_manager", "developer"] as const;
const MANAGE_KPI_ROLES = ["admin", "partner", "project_manager"];
const ASSIGN_OTHERS_ROLES = ["admin", "partner", "project_manager"];

const WORKFLOW_TEMPLATES: Record<
  WorkflowTemplate,
  { label: string; steps: string[]; subTasks: Array<{ title: string; description: string }> }
> = {
  custom: {
    label: "Custom flow",
    steps: ["Start", "Work", "Review", "Done"],
    subTasks: [],
  },
  client_delivery: {
    label: "Client delivery",
    steps: ["Kickoff", "Production", "Client review", "Delivery"],
    subTasks: [
      { title: "Confirm scope and owner", description: "Lock expected output, assignee, and due date." },
      { title: "Prepare first draft", description: "Create the first working version for internal review." },
      { title: "Client review follow-up", description: "Collect comments and update the delivery checklist." },
      { title: "Final delivery handover", description: "Share the final asset and close the loop." },
    ],
  },
  lead_to_delivery: {
    label: "Lead to delivery",
    steps: ["Lead intake", "Proposal", "Onboarding", "Execution"],
    subTasks: [
      { title: "Qualify requirement", description: "Capture budget, timeline, decision maker, and fit." },
      { title: "Send proposal", description: "Prepare pricing and scope for the client." },
      { title: "Complete onboarding", description: "Collect credentials, assets, and approvals." },
      { title: "Start execution", description: "Assign the delivery owner and first milestone." },
    ],
  },
  marketing_campaign: {
    label: "Marketing campaign",
    steps: ["Plan", "Create", "Launch", "Optimize"],
    subTasks: [
      { title: "Campaign brief", description: "Define audience, offer, channel, and budget." },
      { title: "Creative and copy", description: "Prepare campaign assets and approval notes." },
      { title: "Launch checklist", description: "Verify tracking, targeting, and publish settings." },
      { title: "Performance review", description: "Check early results and record next actions." },
    ],
  },
  n8n_automation: {
    label: "n8n style automation",
    steps: ["Trigger", "Transform", "Action", "Notify"],
    subTasks: [
      { title: "Define trigger event", description: "Decide what starts the flow and required payload fields." },
      { title: "Map data fields", description: "Normalize incoming values before the action nodes." },
      { title: "Execute action node", description: "Create or update the target record." },
      { title: "Notify owner", description: "Send status to the responsible user or channel." },
    ],
  },
};

function displayName(user: PopulatedUser | string | null | undefined) {
  if (!user) return "Unassigned";
  if (typeof user === "string") return user;
  return user.fullName || user.email;
}

function userIdOf(user: PopulatedUser | string | null | undefined) {
  if (!user) return "";
  return typeof user === "string" ? user : user._id;
}

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findCell(row: Record<string, unknown>, aliases: string[]) {
  const wanted = new Set(aliases.map(normalizeKey));
  const match = Object.entries(row).find(([key]) => wanted.has(normalizeKey(key)));
  return match ? match[1] : "";
}

function cellToString(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function parseDateInput(value: unknown) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toDateKey(value);
  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value);
    return excelEpoch.toISOString().slice(0, 10);
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "" : toDateKey(parsed);
}

function buildFlowSteps(template: WorkflowTemplate) {
  return WORKFLOW_TEMPLATES[template].steps.map((title, index) => ({
    key: `${template}-${index + 1}`,
    title,
    status: "todo" as TaskStatus,
    order: index,
  }));
}

function buildTemplateSubTasks(template: WorkflowTemplate, assignedToUserId: string) {
  return WORKFLOW_TEMPLATES[template].subTasks.map((subTask, index) => ({
    title: subTask.title,
    description: subTask.description,
    status: "todo" as TaskStatus,
    dueAt: "",
    assignedToUserId,
    sourceSheet: "",
    sourceRow: null,
    order: index,
  }));
}

function serializeSubTasks(subTasks: SubTask[]) {
  return subTasks
    .filter((subTask) => subTask.title.trim())
    .map((subTask, index) => ({
      _id: subTask._id,
      title: subTask.title.trim(),
      description: subTask.description?.trim() || undefined,
      status: subTask.status,
      dueAt: subTask.dueAt || undefined,
      assignedToUserId: userIdOf(subTask.assignedToUserId) || undefined,
      sourceSheet: subTask.sourceSheet || undefined,
      sourceRow: subTask.sourceRow || undefined,
      order: index,
    }));
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
  const [activeTab, setActiveTab] = useState<"tasks" | "calendar" | "analytics" | "kpis">("tasks");
  const [createOpen, setCreateOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [kpis, setKpis] = useState<Kpi[]>(initialKpis);
  const [error, setError] = useState("");

  const canAssignOthers = ASSIGN_OTHERS_ROLES.includes(currentUserRole);

  /**
   * Re-pull the task list after a mutation made elsewhere (bulk bar, row menu).
   *
   * `all=1` is only honoured server-side for roles that may see everyone's work; for everyone
   * else the route narrows the result to their own tasks regardless of the flag.
   */
  const refreshTasks = useCallback(async () => {
    try {
      const refreshed = await callApi<Task[]>(canAssignOthers ? "/api/tasks?all=1" : "/api/tasks");
      setTasks(refreshed);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not refresh tasks.");
    }
  }, [canAssignOthers]);
  const canManageKpis = MANAGE_KPI_ROLES.includes(currentUserRole);

  const [taskForm, setTaskForm] = useState<TaskFormState>({
    title: "",
    description: "",
    dueAt: "",
    assignedToUserId: currentUserId,
    kpiId: "",
    workflowTemplate: "n8n_automation" as WorkflowTemplate,
    subTasks: buildTemplateSubTasks("n8n_automation", currentUserId),
  });
  const [creatingTask, setCreatingTask] = useState(false);
  const [uploadSummary, setUploadSummary] = useState("");

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

  function applyWorkflowTemplate(template: WorkflowTemplate) {
    setTaskForm((form) => ({
      ...form,
      workflowTemplate: template,
      subTasks:
        template === "custom" ? form.subTasks : buildTemplateSubTasks(template, form.assignedToUserId || currentUserId),
    }));
    setUploadSummary("");
  }

  function addManualSubTask() {
    setTaskForm((form) => ({
      ...form,
      subTasks: [
        ...form.subTasks,
        {
          title: "",
          description: "",
          status: "todo",
          dueAt: "",
          assignedToUserId: form.assignedToUserId || currentUserId,
          sourceSheet: "",
          sourceRow: null,
          order: form.subTasks.length,
        },
      ],
    }));
  }

  function updateDraftSubTask(index: number, patch: Partial<SubTask>) {
    setTaskForm((form) => ({
      ...form,
      subTasks: form.subTasks.map((subTask, currentIndex) =>
        currentIndex === index ? { ...subTask, ...patch } : subTask,
      ),
    }));
  }

  function removeDraftSubTask(index: number) {
    setTaskForm((form) => ({
      ...form,
      subTasks: form.subTasks.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  async function handleExcelUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setUploadSummary("Reading workbook...");
    try {
      const xlsx = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: "array", cellDates: true });
      const imported: SubTask[] = [];

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
        rows.forEach((row, rowIndex) => {
          const title = cellToString(
            findCell(row, ["sub task", "subtask", "task", "task title", "title", "name", "activity", "step"]),
          );
          if (!title) return;

          const assigneeText = cellToString(findCell(row, ["assignee", "assigned to", "owner", "email"])).toLowerCase();
          const matchedUser = assignableUsers.find((user) => {
            const name = user.fullName.toLowerCase();
            const email = user.email.toLowerCase();
            return assigneeText && (assigneeText === email || assigneeText === name || email.includes(assigneeText));
          });

          imported.push({
            title,
            description: cellToString(findCell(row, ["description", "details", "notes", "remark", "remarks"])),
            status: "todo",
            dueAt: parseDateInput(findCell(row, ["due", "due date", "deadline", "date"])),
            assignedToUserId: matchedUser?._id ?? taskForm.assignedToUserId,
            sourceSheet: sheetName,
            sourceRow: rowIndex + 2,
            order: imported.length,
          });
        });
      }

      if (!imported.length) {
        setUploadSummary("");
        setError("No subtasks found. Use a column like Sub Task, Task, Title, Activity, or Step.");
        return;
      }

      setTaskForm((form) => ({
        ...form,
        subTasks: imported.map((subTask, index) => ({
          ...subTask,
          assignedToUserId: subTask.assignedToUserId || form.assignedToUserId || currentUserId,
          order: index,
        })),
      }));
      setUploadSummary(`Imported ${imported.length} subtasks from ${file.name}.`);
    } catch (nextError) {
      setUploadSummary("");
      setError(nextError instanceof Error ? nextError.message : "Could not read the Excel file.");
    } finally {
      event.target.value = "";
    }
  }

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
          workflowTemplate: taskForm.workflowTemplate,
          flowSteps: buildFlowSteps(taskForm.workflowTemplate),
          subTasks: serializeSubTasks(taskForm.subTasks),
        }),
      });
      setTasks((current) => [created, ...current]);
      setTaskForm({
        title: "",
        description: "",
        dueAt: "",
        assignedToUserId: currentUserId,
        kpiId: "",
        workflowTemplate: "n8n_automation",
        subTasks: buildTemplateSubTasks("n8n_automation", currentUserId),
      });
      setUploadSummary("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create task.");
    } finally {
      setCreatingTask(false);
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
      <div className="flex gap-1 overflow-x-auto border-b border-vega-border-soft no-scrollbar">
        {(["tasks", "calendar", "analytics", "kpis"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap px-3 py-3 text-xs font-medium capitalize transition-colors ${
              activeTab === tab
                ? "border-b-2 border-vega-purple text-[#c4b5fd]"
                : "text-vega-text-muted hover:text-vega-text-secondary"
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
          {createOpen ? (
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
                      onChange={(event) =>
                        setTaskForm((form) => ({
                          ...form,
                          assignedToUserId: event.target.value,
                          subTasks: form.subTasks.map((subTask) => ({
                            ...subTask,
                            assignedToUserId: userIdOf(subTask.assignedToUserId) || event.target.value,
                          })),
                        }))
                      }
                      className="h-11 rounded-xl border border-border/90 bg-vega-surface-1 px-3.5 text-sm text-foreground"
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
                  <select
                    value={taskForm.workflowTemplate}
                    onChange={(event) => applyWorkflowTemplate(event.target.value as WorkflowTemplate)}
                    className="h-11 rounded-xl border border-border/90 bg-vega-surface-1 px-3.5 text-sm text-foreground"
                  >
                    {(Object.keys(WORKFLOW_TEMPLATES) as WorkflowTemplate[]).map((template) => (
                      <option key={template} value={template}>
                        {WORKFLOW_TEMPLATES[template].label}
                      </option>
                    ))}
                  </select>
                  {kpis.length > 0 ? (
                    <select
                      value={taskForm.kpiId}
                      onChange={(event) => setTaskForm((form) => ({ ...form, kpiId: event.target.value }))}
                      className="h-11 rounded-xl border border-border/90 bg-vega-surface-1 px-3.5 text-sm text-foreground sm:col-span-2"
                    >
                      <option value="">Not linked to a KPI</option>
                      {kpis.map((kpi) => (
                        <option key={kpi._id} value={kpi._id}>
                          Counts toward: {kpi.title}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <div className="sm:col-span-2 rounded-lg border border-border/80 bg-surface-soft/50 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Subtasks</p>
                        {uploadSummary ? <p className="text-xs text-success">{uploadSummary}</p> : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-vega-surface-1 px-3 text-sm font-semibold text-foreground shadow-sm hover:border-accent/40 hover:bg-surface-soft">
                          Upload Excel
                          <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleExcelUpload}
                            className="sr-only"
                          />
                        </label>
                        <Button type="button" variant="secondary" size="sm" onClick={addManualSubTask}>
                          Add subtask
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {buildFlowSteps(taskForm.workflowTemplate).map((step, index, steps) => (
                        <div key={step.key} className="flex items-center gap-2">
                          <span className="rounded-md border border-accent/25 bg-vega-surface-1 px-2.5 py-1 text-[11px] font-semibold text-accent-strong">
                            {step.title}
                          </span>
                          {index < steps.length - 1 ? <span className="text-xs text-muted-foreground">-&gt;</span> : null}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 space-y-2">
                      {taskForm.subTasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Add manual subtasks or upload an Excel sheet.</p>
                      ) : null}
                      {taskForm.subTasks.map((subTask, index) => (
                        <div key={`${subTask.sourceSheet ?? "manual"}-${subTask.sourceRow ?? index}`} className="grid gap-2 rounded-lg border border-border/70 bg-vega-surface-1 p-2 sm:grid-cols-[1.2fr_1.4fr_0.8fr_1fr_auto]">
                          <Input
                            placeholder="Subtask title"
                            value={subTask.title}
                            onChange={(event) => updateDraftSubTask(index, { title: event.target.value })}
                          />
                          <Input
                            placeholder="Description"
                            value={subTask.description}
                            onChange={(event) => updateDraftSubTask(index, { description: event.target.value })}
                          />
                          <Input
                            type="date"
                            value={subTask.dueAt ?? ""}
                            onChange={(event) => updateDraftSubTask(index, { dueAt: event.target.value })}
                          />
                          {canAssignOthers ? (
                            <select
                              value={userIdOf(subTask.assignedToUserId) || taskForm.assignedToUserId}
                              onChange={(event) => updateDraftSubTask(index, { assignedToUserId: event.target.value })}
                              className="h-11 rounded-xl border border-border/90 bg-vega-surface-1 px-3.5 text-sm text-foreground"
                            >
                              <option value={taskForm.assignedToUserId}>Parent assignee</option>
                              {assignableUsers.map((user) => (
                                <option key={user._id} value={user._id}>
                                  {user.fullName}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <Button type="button" variant="secondary" size="sm" onClick={() => removeDraftSubTask(index)}>
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" disabled={creatingTask} className="sm:col-span-2 justify-self-start">
                    {creatingTask ? "Adding..." : "Create task flow"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <TasksWorkspace
            tasks={tasks as unknown as WorkspaceTask[]}
            currentUserId={currentUserId}
            canAssignOthers={canAssignOthers}
            assignableUsers={assignableUsers}
            onRefresh={refreshTasks}
            onCreateTask={() => setCreateOpen((open) => !open)}
          />
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
                    cell.inCurrentMonth ? "border-border/70 bg-vega-surface-1" : "border-border/40 bg-muted/20 text-muted-foreground"
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

      {activeTab === "analytics" && (
        <TaskAnalyticsPanel
          assignableUsers={assignableUsers}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
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
                    className="h-11 rounded-xl border border-border/90 bg-vega-surface-1 px-3.5 text-sm text-foreground"
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
                    className="h-11 rounded-xl border border-border/90 bg-vega-surface-1 px-3.5 text-sm text-foreground"
                  >
                    <option value="">No role target</option>
                    {ASSIGNABLE_ROLES.map((role) => (
                      <option key={role} value={role}>Team-wide: {role}</option>
                    ))}
                  </select>
                  <select
                    value={kpiForm.assignedUserId}
                    onChange={(event) => setKpiForm((form) => ({ ...form, assignedUserId: event.target.value }))}
                    className="h-11 rounded-xl border border-border/90 bg-vega-surface-1 px-3.5 text-sm text-foreground"
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

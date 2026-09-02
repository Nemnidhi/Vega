"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import dynamic from "next/dynamic";

/**
 * The Workflow canvas and the Gantt are the two heaviest things in the app - the canvas alone
 * pulls @xyflow/react. Statically imported they landed in the same chunk as this component, so
 * every Task Workspace visit paid for them even when the reader never left the Subtasks tab.
 * Loaded on demand instead; both sit behind tabs, so nothing renders them until they are opened.
 */
const TaskWorkflowBuilder = dynamic(
  () => import("@/components/tasks/task-workflow-builder").then((m) => m.TaskWorkflowBuilder),
  { ssr: false, loading: () => <TabPanelSkeleton label="Loading workflow canvas..." /> },
);

const TaskTimelineGantt = dynamic(
  () => import("@/components/tasks/task-timeline-gantt").then((m) => m.TaskTimelineGantt),
  { ssr: false, loading: () => <TabPanelSkeleton label="Loading timeline..." /> },
);

/** Matches the panel shape the real content lands in, so the tab does not jump on load. */
function TabPanelSkeleton({ label }: { label: string }) {
  return (
    <div className="flex h-[420px] items-center justify-center rounded-lg border border-vega-border bg-vega-surface-1">
      <p className="text-xs text-vega-text-muted">{label}</p>
    </div>
  );
}
import { SubtaskContextDrawer, type DrawerSubtask } from "@/components/tasks/subtask-context-drawer";
import { TaskDependenciesPanel } from "@/components/tasks/task-dependencies-panel";
import { TaskChecklistPanel } from "@/components/tasks/task-checklist-panel";
import { isCompletedStatus } from "@/lib/tasks/status";

type PopulatedUser = { _id: string; fullName: string; email: string; role?: string };
type SubtaskStatus =
  | "NOT_STARTED"
  | "READY"
  | "IN_PROGRESS"
  | "WAITING"
  | "BLOCKED"
  | "REVIEW"
  | "COMPLETED"
  | "CANCELLED";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "accent";

type ChecklistItem = {
  _id?: string;
  title: string;
  completed: boolean;
  order: number;
};

type Attachment = {
  _id?: string;
  name: string;
  url: string;
  mimeType?: string;
  sizeBytes?: number | null;
};

type Comment = {
  _id?: string;
  body: string;
  createdBy?: PopulatedUser | string;
  createdAt?: string;
};

type DependencyType = "FINISH_TO_START" | "START_TO_START" | "FINISH_TO_FINISH";
type WorkflowNodeType = "SUBTASK" | "MILESTONE" | "APPROVAL" | "CONDITION" | "MERGE" | "WAIT" | "START" | "END";

type WorkflowStage = {
  key: string;
  name: string;
  color: string;
  collapsed: boolean;
  order: number;
};

type DependencySubtaskRef = {
  _id: string;
  code?: string;
  title: string;
  status: string;
};

type SubtaskDependency = {
  _id: string;
  predecessorSubtaskId: DependencySubtaskRef | string;
  successorSubtaskId: DependencySubtaskRef | string;
  dependencyType: DependencyType;
  lagDuration?: number | null;
  createdAt?: string;
};

type TaskRecord = {
  _id: string;
  code?: string;
  title: string;
  description?: string;
  status: string;
  priority?: Priority;
  assignedToUserId: PopulatedUser | string;
  createdBy: PopulatedUser | string;
  startAt?: string | null;
  dueAt?: string | null;
  estimatedEffortHours?: number | null;
  actualEffortHours?: number | null;
  progressPercent?: number;
  tags?: string[];
  stage?: string;
  attachments?: Attachment[];
  comments?: Comment[];
  checklist?: ChecklistItem[];
  blockedBy?: SubtaskDependency[];
  blocking?: SubtaskDependency[];
  workflowPositionX?: number | null;
  workflowPositionY?: number | null;
  workflowWidth?: number | null;
  workflowCollapsed?: boolean;
  workflowGroup?: string;
  workflowNodeType?: WorkflowNodeType;
  workflowDecision?: string;
  workflowStages?: WorkflowStage[];
  createdAt?: string;
  updatedAt?: string;
};

type ActivityLogRecord = {
  _id: string;
  action: string;
  actorId?: PopulatedUser | string | null;
  details?: {
    message?: string;
    subtaskId?: string;
    from?: unknown;
    to?: unknown;
    [key: string]: unknown;
  };
  createdAt?: string;
};

type AiAssistantMode =
  | "generate_subtasks"
  | "break_down_subtask"
  | "suggest_dependencies"
  | "generate_workflow"
  | "detect_problems";

type AiProposalSubtask = {
  tempId?: string;
  key?: string;
  title: string;
  description?: string;
  status?: SubtaskStatus;
  priority?: Priority;
  estimatedEffortHours?: number | null;
  stage?: string;
  tags?: string[];
  workflowNodeType?: WorkflowNodeType;
};

type AiProposalDependency = {
  predecessorTempId?: string;
  successorTempId?: string;
  predecessorKey?: string;
  successorKey?: string;
  predecessorSubtaskId?: string;
  successorSubtaskId?: string;
  dependencyType?: DependencyType;
};

type AiProposalProblem = {
  severity?: "warning" | "danger";
  title: string;
  detail: string;
  subtaskIds?: string[];
};

type AiProposal = {
  summary: string;
  source: "ai" | "rules";
  subtasks: AiProposalSubtask[];
  checklistItems: ChecklistItem[];
  dependencies: AiProposalDependency[];
  problems: AiProposalProblem[];
};

type ImportField =
  | "ignore"
  | "subtaskId"
  | "name"
  | "description"
  | "assignedTo"
  | "assigneeEmail"
  | "priority"
  | "status"
  | "startDate"
  | "dueDate"
  | "estimatedHours"
  | "dependsOn"
  | "stage"
  | "tags";

type ImportIssue = {
  rowNumber: number;
  level: "warning" | "error";
  field: string;
  message: string;
};

type ImportRow = {
  rowNumber: number;
  values: Record<string, string>;
};

type ImportSummary = {
  totalRows: number;
  validRows: number;
  warningCount: number;
  errorCount: number;
  importedRows: number;
  failedRows: number;
};

type ImportPreview = {
  importJobId: string;
  fileName: string;
  fileType: "xlsx" | "xls" | "csv";
  headers: string[];
  previewRows: ImportRow[];
  mapping: Record<string, ImportField>;
  summary: ImportSummary;
  issues?: ImportIssue[];
};

type ImportHistoryItem = {
  _id: string;
  fileName: string;
  status: string;
  summary?: ImportSummary;
  createdAt?: string;
  importedAt?: string | null;
};

type ImportResult = {
  importJobId: string;
  summary: ImportSummary;
  importedRows: number;
  skippedRows: number;
  dependencyCount: number;
};

type DraftState = {
  _id?: string;
  code?: string;
  title: string;
  description: string;
  assignedToUserId: string;
  status: SubtaskStatus;
  priority: Priority;
  startAt: string;
  dueAt: string;
  estimatedEffortHours: string;
  actualEffortHours: string;
  progressPercent: number;
  tagsText: string;
  stage: string;
  attachments: Attachment[];
  comments: Comment[];
  checklist: ChecklistItem[];
};

type TaskDetailTabsProps = {
  task: TaskRecord;
  initialSubtasks: TaskRecord[];
  assignableUsers: PopulatedUser[];
  currentUserId: string;
  currentUserRole: string;
};

const STATUSES: SubtaskStatus[] = [
  "NOT_STARTED",
  "READY",
  "IN_PROGRESS",
  "WAITING",
  "BLOCKED",
  "REVIEW",
  "COMPLETED",
  "CANCELLED",
];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const DEPENDENCY_TYPES: DependencyType[] = ["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH"];
const ASSIGN_OTHERS_ROLES = ["admin", "partner", "project_manager"];
const TABS = [
  "Overview",
  "Subtasks",
  "Dependencies",
  "Checklist",
  "Workflow",
  "Timeline",
  "Comments",
  "Files",
  "Activity",
  "AI Assistant",
] as const;
const AI_MODES: { mode: AiAssistantMode; label: string }[] = [
  { mode: "generate_subtasks", label: "Generate Subtasks" },
  { mode: "break_down_subtask", label: "Break Down Subtask" },
  { mode: "suggest_dependencies", label: "Suggest Dependencies" },
  { mode: "generate_workflow", label: "Generate Workflow" },
  { mode: "detect_problems", label: "Detect Problems" },
];
const IMPORT_FIELDS: { value: ImportField; label: string }[] = [
  { value: "ignore", label: "Ignore" },
  { value: "subtaskId", label: "Subtask ID" },
  { value: "name", label: "Subtask Name" },
  { value: "description", label: "Description" },
  { value: "assignedTo", label: "Assigned To" },
  { value: "assigneeEmail", label: "Assignee Email" },
  { value: "priority", label: "Priority" },
  { value: "status", label: "Status" },
  { value: "startDate", label: "Start Date" },
  { value: "dueDate", label: "Due Date" },
  { value: "estimatedHours", label: "Estimated Hours" },
  { value: "dependsOn", label: "Depends On" },
  { value: "stage", label: "Stage" },
  { value: "tags", label: "Tags" },
];
const IMPORT_STEPS = ["Upload", "Preview", "Mapping", "Validation", "Import"] as const;

function displayName(user: PopulatedUser | string | null | undefined) {
  if (!user) return "Unassigned";
  if (typeof user === "string") return user;
  return user.fullName || user.email;
}

function userIdOf(user: PopulatedUser | string | null | undefined) {
  if (!user) return "";
  return typeof user === "string" ? user : user._id;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function statusVariant(status: string): BadgeVariant {
  if (status === "COMPLETED") return "success";
  if (status === "BLOCKED" || status === "CANCELLED") return "danger";
  if (status === "WAITING" || status === "REVIEW") return "warning";
  if (status === "IN_PROGRESS" || status === "READY") return "accent";
  return "neutral";
}

function priorityVariant(priority?: string): BadgeVariant {
  if (priority === "URGENT") return "danger";
  if (priority === "HIGH") return "warning";
  if (priority === "MEDIUM") return "accent";
  return "neutral";
}

function dependencyRef(value: DependencySubtaskRef | string) {
  if (typeof value === "string") {
    return { _id: value, title: value, status: "", code: "" };
  }
  return value;
}

function dependencyLabel(value: DependencySubtaskRef | string) {
  const ref = dependencyRef(value);
  return `${ref.code || ref._id} ${ref.title}`;
}

function isDependencyComplete(value: DependencySubtaskRef | string, dependencyType: DependencyType) {
  const status = dependencyRef(value).status;
  if (dependencyType === "START_TO_START") {
    return ["IN_PROGRESS", "REVIEW", "COMPLETED"].includes(status);
  }
  return status === "COMPLETED";
}

function blankDraft(assigneeId: string): DraftState {
  return {
    title: "",
    description: "",
    assignedToUserId: assigneeId,
    status: "NOT_STARTED",
    priority: "MEDIUM",
    startAt: "",
    dueAt: "",
    estimatedEffortHours: "",
    actualEffortHours: "",
    progressPercent: 0,
    tagsText: "",
    stage: "",
    attachments: [],
    comments: [],
    checklist: [],
  };
}

function draftFromSubtask(subtask: TaskRecord): DraftState {
  return {
    _id: subtask._id,
    code: subtask.code,
    title: subtask.title,
    description: subtask.description ?? "",
    assignedToUserId: userIdOf(subtask.assignedToUserId),
    status: (subtask.status as SubtaskStatus) || "NOT_STARTED",
    priority: subtask.priority ?? "MEDIUM",
    startAt: toDateInput(subtask.startAt),
    dueAt: toDateInput(subtask.dueAt),
    estimatedEffortHours: subtask.estimatedEffortHours?.toString() ?? "",
    actualEffortHours: subtask.actualEffortHours?.toString() ?? "",
    progressPercent: subtask.progressPercent ?? 0,
    tagsText: (subtask.tags ?? []).join(", "),
    stage: subtask.stage ?? "",
    attachments: subtask.attachments ?? [],
    comments: subtask.comments ?? [],
    checklist: subtask.checklist ?? [],
  };
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

async function callUploadApi<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    body: formData,
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload?.error?.message ?? "Request failed.");
  }
  return payload.data as T;
}

function serializeDraft(draft: DraftState) {
  return {
    title: draft.title,
    description: draft.description || undefined,
    assignedToUserId: draft.assignedToUserId || undefined,
    status: draft.status,
    priority: draft.priority,
    startAt: draft.startAt || null,
    dueAt: draft.dueAt || null,
    estimatedEffortHours: draft.estimatedEffortHours ? Number(draft.estimatedEffortHours) : null,
    actualEffortHours: draft.actualEffortHours ? Number(draft.actualEffortHours) : null,
    progressPercent: draft.progressPercent,
    tags: draft.tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    stage: draft.stage || undefined,
    attachments: draft.attachments.filter((item) => item.name.trim() && item.url.trim()),
    comments: draft.comments.filter((item) => item.body.trim()).map((item) => ({ _id: item._id, body: item.body })),
    checklist: draft.checklist
      .filter((item) => item.title.trim())
      .map((item, index) => ({ _id: item._id, title: item.title, completed: item.completed, order: index })),
  };
}

function activityActorName(activity: ActivityLogRecord) {
  if (!activity.actorId) return "System";
  return displayName(activity.actorId);
}

function activityMessage(activity: ActivityLogRecord) {
  const message = activity.details?.message;
  if (message) return `${activityActorName(activity)} ${message}.`;

  if (activity.action === "workflow_node_status_changed") {
    return `${activityActorName(activity)} changed subtask status.`;
  }
  if (activity.action === "workflow_node_rescheduled") {
    return `${activityActorName(activity)} rescheduled a workflow item.`;
  }
  if (activity.action === "subtask_dependency_added") {
    return `${activityActorName(activity)} connected subtasks.`;
  }
  if (activity.action === "subtask_dependency_removed") {
    return `${activityActorName(activity)} removed a dependency.`;
  }

  return `${activityActorName(activity)} ${humanize(activity.action).toLowerCase()}.`;
}

export function TaskDetailTabs({
  task,
  initialSubtasks,
  assignableUsers,
  currentUserId,
  currentUserRole,
}: TaskDetailTabsProps) {
  const canAssignOthers = ASSIGN_OTHERS_ROLES.includes(currentUserRole);
  // Managers, plus the task's own assignee or creator. The server enforces this too - this
  // only decides whether to render the controls.
  const canEdit =
    canAssignOthers ||
    userIdOf(task.assignedToUserId) === currentUserId ||
    userIdOf(task.createdBy) === currentUserId;
  const defaultAssigneeId = userIdOf(task.assignedToUserId) || currentUserId;
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Subtasks");
  const [subtasks, setSubtasks] = useState<TaskRecord[]>(initialSubtasks);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contextSubtaskId, setContextSubtaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(() => blankDraft(defaultAssigneeId));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkPriority, setBulkPriority] = useState("");
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [taskActivity, setTaskActivity] = useState<ActivityLogRecord[]>([]);
  const [subtaskActivity, setSubtaskActivity] = useState<ActivityLogRecord[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [aiMode, setAiMode] = useState<AiAssistantMode>("generate_subtasks");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSubtaskId, setAiSubtaskId] = useState("");
  const [aiProposal, setAiProposal] = useState<AiProposal | null>(null);
  const [aiBusy, setAiBusy] = useState("");
  const [aiError, setAiError] = useState("");
  const [dependencyForm, setDependencyForm] = useState({
    predecessorSubtaskId: "",
    dependencyType: "FINISH_TO_START" as DependencyType,
    lagDuration: "",
  });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<(typeof IMPORT_STEPS)[number]>("Upload");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMapping, setImportMapping] = useState<Record<string, ImportField>>({});
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [importLoading, setImportLoading] = useState("");
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const assigneeOptions = canAssignOthers
    ? assignableUsers
    : [{ _id: currentUserId, fullName: "Me", email: "", role: currentUserRole }];

  const filteredSubtasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return subtasks.filter((subtask) => {
      const matchesSearch =
        !normalizedSearch ||
        subtask.title.toLowerCase().includes(normalizedSearch) ||
        (subtask.code ?? "").toLowerCase().includes(normalizedSearch) ||
        (subtask.description ?? "").toLowerCase().includes(normalizedSearch);
      const matchesStatus = !statusFilter || subtask.status === statusFilter;
      const matchesPriority = !priorityFilter || subtask.priority === priorityFilter;
      const matchesAssignee = !assigneeFilter || userIdOf(subtask.assignedToUserId) === assigneeFilter;
      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
    });
  }, [assigneeFilter, priorityFilter, search, statusFilter, subtasks]);
  const totalPages = Math.max(1, Math.ceil(filteredSubtasks.length / pageSize));

  // Derived during render rather than corrected in an effect. Filtering can shrink the result set
  // below the current page, and syncing that back through setState caused a cascading re-render.
  const currentPage = Math.min(page, totalPages);

  const visibleSubtasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSubtasks.slice(start, start + pageSize);
  }, [filteredSubtasks, currentPage, pageSize]);

  const completedCount = subtasks.filter((subtask) => isCompletedStatus(subtask.status)).length;
  const completionPercent = subtasks.length ? Math.round((completedCount / subtasks.length) * 100) : 0;

  const loadImportHistory = useCallback(async () => {
    try {
      const history = await callApi<ImportHistoryItem[]>(`/api/tasks/${task._id}/subtasks/import`);
      setImportHistory(history);
    } catch {
      setImportHistory([]);
    }
  }, [task._id]);

  useEffect(() => {
    if (!importOpen) return;
    let active = true;

    async function syncImportHistory() {
      // Deferred a microtask so the state update lands outside the effect body.
      await Promise.resolve();
      if (!active) return;
      await loadImportHistory();
    }

    void syncImportHistory();
    return () => {
      active = false;
    };
  }, [importOpen, loadImportHistory]);

  useEffect(() => {
    if (activeTab !== "Activity") return;
    let active = true;

    async function loadTaskActivity() {
      await Promise.resolve();
      if (!active) return;
      setActivityLoading(true);
      setActivityError("");
      try {
        const data = await callApi<ActivityLogRecord[]>(`/api/tasks/${task._id}/activity`);
        if (active) setTaskActivity(data);
      } catch (nextError) {
        if (active) setActivityError(nextError instanceof Error ? nextError.message : "Could not load task activity.");
      } finally {
        if (active) setActivityLoading(false);
      }
    }

    void loadTaskActivity();

    return () => {
      active = false;
    };
  }, [activeTab, task._id]);

  useEffect(() => {
    if (!drawerOpen || !draft._id) return;

    let active = true;
    callApi<ActivityLogRecord[]>(`/api/tasks/${task._id}/activity?subtaskId=${draft._id}`)
      .then((data) => {
        if (active) setSubtaskActivity(data);
      })
      .catch(() => {
        if (active) setSubtaskActivity([]);
      });

    return () => {
      active = false;
    };
  }, [drawerOpen, draft._id, task._id]);

  function openCreateDrawer() {
    setDraft(blankDraft(defaultAssigneeId));
    setDependencyForm({ predecessorSubtaskId: "", dependencyType: "FINISH_TO_START", lagDuration: "" });
    setSubtaskActivity([]);
    setDrawerOpen(true);
  }

  function openEditDrawer(subtask: TaskRecord) {
    setDraft(draftFromSubtask(subtask));
    setDependencyForm({ predecessorSubtaskId: "", dependencyType: "FINISH_TO_START", lagDuration: "" });
    setSubtaskActivity([]);
    setDrawerOpen(true);
  }

  async function refreshSubtasks() {
    const data = await callApi<TaskRecord[]>(`/api/tasks/${task._id}/subtasks`);
    setSubtasks(data);
    setSelectedIds([]);
  }

  const contextSubtask = contextSubtaskId
    ? (subtasks.find((subtask) => subtask._id === contextSubtaskId) ?? null)
    : null;

  /**
   * Every dependency edge under this task, deduped.
   *
   * The subtask payload carries blockedBy/blocking per row, so the same edge appears twice -
   * once on each end. Collapsing by id here avoids a second round trip for the graph.
   */
  const allDependencies = useMemo(() => {
    const byId = new Map<string, SubtaskDependency>();
    for (const subtask of subtasks) {
      for (const dependency of subtask.blockedBy ?? []) byId.set(dependency._id, dependency);
      for (const dependency of subtask.blocking ?? []) byId.set(dependency._id, dependency);
    }
    return Array.from(byId.values());
  }, [subtasks]);

  async function patchSubtask(subtaskId: string, patch: Record<string, unknown>) {
    setBusy(subtaskId);
    setError("");
    try {
      await callApi(`/api/tasks/${task._id}/subtasks/${subtaskId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await refreshSubtasks();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not update the subtask.");
    } finally {
      setBusy("");
    }
  }

  async function addSubtaskComment(subtaskId: string, body: string) {
    const subtask = subtasks.find((item) => item._id === subtaskId);
    if (!subtask) return;
    // The subtask PATCH replaces the comment array wholesale, so send the existing ones back.
    const existing = (subtask.comments ?? []).map((comment) => ({ body: comment.body }));
    await patchSubtask(subtaskId, { comments: [...existing, { body }] });
  }

  async function toggleChecklistItem(subtaskId: string, itemId: string, completed: boolean) {
    const subtask = subtasks.find((item) => item._id === subtaskId);
    if (!subtask) return;
    const checklist = (subtask.checklist ?? []).map((item) => ({
      title: item.title,
      completed: item._id === itemId ? completed : item.completed,
      order: item.order,
    }));
    await patchSubtask(subtaskId, { checklist });
  }

  async function createDependency(input: {
    predecessorSubtaskId: string;
    successorSubtaskId: string;
    dependencyType: string;
  }) {
    setBusy("dependency");
    setError("");
    try {
      await callApi(`/api/tasks/${task._id}/subtasks/dependencies`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      await refreshSubtasks();
    } catch (nextError) {
      // Rethrown so the panel can surface it inline next to the form.
      throw nextError instanceof Error ? nextError : new Error("Could not create the dependency.");
    } finally {
      setBusy("");
    }
  }

  async function saveTaskChecklist(checklist: Array<{ title: string; completed: boolean; order: number }>) {
    setBusy("checklist");
    setError("");
    try {
      await callApi(`/api/tasks/${task._id}`, {
        method: "PATCH",
        body: JSON.stringify({ checklist }),
      });
      window.location.reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not update the checklist.");
    } finally {
      setBusy("");
    }
  }

  async function uploadImportFile(file: File) {
    setImportLoading("upload");
    setImportError("");
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const preview = await callUploadApi<ImportPreview>(`/api/tasks/${task._id}/subtasks/import`, formData);
      setImportPreview(preview);
      setImportMapping(preview.mapping);
      setImportStep("Preview");
      await loadImportHistory();
    } catch (nextError) {
      setImportError(nextError instanceof Error ? nextError.message : "Could not upload import file.");
    } finally {
      setImportLoading("");
    }
  }

  function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void uploadImportFile(file);
    event.target.value = "";
  }

  function handleImportDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadImportFile(file);
  }

  async function validateImport() {
    if (!importPreview) return;
    setImportLoading("validate");
    setImportError("");
    try {
      const validation = await callApi<Pick<ImportPreview, "importJobId" | "summary" | "issues"> & { rows: unknown[] }>(
        `/api/tasks/${task._id}/subtasks/import/validate`,
        {
          method: "POST",
          body: JSON.stringify({ importJobId: importPreview.importJobId, mapping: importMapping }),
        },
      );
      setImportPreview((current) =>
        current
          ? {
              ...current,
              mapping: importMapping,
              summary: validation.summary,
              issues: validation.issues,
            }
          : current,
      );
      setImportStep("Validation");
      await loadImportHistory();
    } catch (nextError) {
      setImportError(nextError instanceof Error ? nextError.message : "Could not validate import file.");
    } finally {
      setImportLoading("");
    }
  }

  async function executeImport(importValidRowsOnly = true) {
    if (!importPreview) return;
    setImportLoading("execute");
    setImportError("");
    try {
      const result = await callApi<ImportResult>(`/api/tasks/${task._id}/subtasks/import/execute`, {
        method: "POST",
        body: JSON.stringify({
          importJobId: importPreview.importJobId,
          mapping: importMapping,
          importValidRowsOnly,
        }),
      });
      setImportResult(result);
      setImportStep("Import");
      await refreshSubtasks();
      await loadImportHistory();
    } catch (nextError) {
      setImportError(nextError instanceof Error ? nextError.message : "Could not import subtasks.");
    } finally {
      setImportLoading("");
    }
  }

  async function requestAiProposal(mode = aiMode) {
    setAiBusy("proposal");
    setAiError("");
    try {
      const proposal = await callApi<AiProposal>(`/api/tasks/${task._id}/ai-assistant`, {
        method: "POST",
        body: JSON.stringify({
          mode,
          prompt: aiPrompt,
          subtaskId: mode === "break_down_subtask" ? aiSubtaskId || undefined : undefined,
        }),
      });
      setAiMode(mode);
      setAiProposal(proposal);
    } catch (nextError) {
      setAiError(nextError instanceof Error ? nextError.message : "Could not generate AI proposal.");
    } finally {
      setAiBusy("");
    }
  }

  function updateAiSubtask(index: number, patch: Partial<AiProposalSubtask>) {
    setAiProposal((current) => {
      if (!current) return current;
      return {
        ...current,
        subtasks: current.subtasks.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item)),
      };
    });
  }

  async function applyAiProposal() {
    if (!aiProposal) return;
    setAiBusy("apply");
    setAiError("");
    try {
      const createdIdByKey = new Map<string, string>();

      for (const item of aiProposal.subtasks) {
        if (!item.title?.trim()) continue;
        const created = await callApi<TaskRecord>(`/api/tasks/${task._id}/subtasks`, {
          method: "POST",
          body: JSON.stringify({
            title: item.title,
            description: item.description ?? "",
            status: item.status ?? "NOT_STARTED",
            priority: item.priority ?? "MEDIUM",
            assignedToUserId: defaultAssigneeId,
            estimatedEffortHours: item.estimatedEffortHours ?? null,
            tags: item.tags ?? [],
            stage: item.stage ?? "",
            workflowGroup: item.stage ?? "",
            workflowNodeType: item.workflowNodeType ?? "SUBTASK",
          }),
        });
        [item.tempId, item.key, item.title].filter(Boolean).forEach((key) => createdIdByKey.set(String(key), created._id));
      }

      const selected = aiSubtaskId ? subtasks.find((subtask) => subtask._id === aiSubtaskId) : null;
      if (selected && aiProposal.checklistItems.length > 0) {
        await callApi<TaskRecord>(`/api/tasks/${task._id}/subtasks/${selected._id}`, {
          method: "PATCH",
          body: JSON.stringify({
            checklist: [
              ...(selected.checklist ?? []).map((item, index) => ({
                _id: item._id,
                title: item.title,
                completed: item.completed,
                order: item.order ?? index,
              })),
              ...aiProposal.checklistItems.map((item, index) => ({
                title: item.title,
                completed: false,
                order: (selected.checklist?.length ?? 0) + index,
              })),
            ],
          }),
        });
      }

      const existingDependencyKeys = new Set(
        subtasks.flatMap((subtask) =>
          (subtask.blockedBy ?? []).map((dependency) => {
            const predecessor = dependencyRef(dependency.predecessorSubtaskId);
            return `${predecessor._id}:${subtask._id}:${dependency.dependencyType}`;
          }),
        ),
      );

      for (const dependency of aiProposal.dependencies) {
        const predecessorSubtaskId =
          dependency.predecessorSubtaskId ??
          createdIdByKey.get(String(dependency.predecessorTempId ?? "")) ??
          createdIdByKey.get(String(dependency.predecessorKey ?? ""));
        const successorSubtaskId =
          dependency.successorSubtaskId ??
          createdIdByKey.get(String(dependency.successorTempId ?? "")) ??
          createdIdByKey.get(String(dependency.successorKey ?? ""));
        const dependencyType = dependency.dependencyType ?? "FINISH_TO_START";
        if (!predecessorSubtaskId || !successorSubtaskId || predecessorSubtaskId === successorSubtaskId) continue;
        if (existingDependencyKeys.has(`${predecessorSubtaskId}:${successorSubtaskId}:${dependencyType}`)) continue;
        await callApi(`/api/tasks/${task._id}/subtasks/dependencies`, {
          method: "POST",
          body: JSON.stringify({ predecessorSubtaskId, successorSubtaskId, dependencyType }),
        });
      }

      await refreshSubtasks();
      setAiProposal(null);
    } catch (nextError) {
      setAiError(nextError instanceof Error ? nextError.message : "Could not apply AI proposal.");
    } finally {
      setAiBusy("");
    }
  }

  async function saveDraft() {
    if (!draft.title.trim()) {
      setError("Subtask title is required.");
      return;
    }
    if (draft.startAt && draft.dueAt && new Date(draft.startAt) > new Date(draft.dueAt)) {
      setError("Due date cannot be before start date.");
      return;
    }
    setBusy("save");
    setError("");
    try {
      if (draft._id) {
        const updated = await callApi<TaskRecord>(`/api/tasks/${task._id}/subtasks/${draft._id}`, {
          method: "PATCH",
          body: JSON.stringify(serializeDraft(draft)),
        });
        setSubtasks((current) => current.map((item) => (item._id === updated._id ? updated : item)));
        await refreshSubtasks();
      } else {
        const created = await callApi<TaskRecord>(`/api/tasks/${task._id}/subtasks`, {
          method: "POST",
          body: JSON.stringify(serializeDraft(draft)),
        });
        setSubtasks((current) => [...current, created]);
        await refreshSubtasks();
      }
      setDrawerOpen(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save subtask.");
    } finally {
      setBusy("");
    }
  }

  async function deleteSubtask(subtaskId: string) {
    setBusy(subtaskId);
    setError("");
    try {
      await callApi(`/api/tasks/${task._id}/subtasks/${subtaskId}`, { method: "DELETE" });
      setSubtasks((current) => current.filter((item) => item._id !== subtaskId));
      setSelectedIds((current) => current.filter((id) => id !== subtaskId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete subtask.");
    } finally {
      setBusy("");
    }
  }

  async function duplicateSubtask(subtaskId: string) {
    setBusy(subtaskId);
    setError("");
    try {
      const duplicated = await callApi<TaskRecord>(`/api/tasks/${task._id}/subtasks/${subtaskId}/duplicate`, {
        method: "POST",
      });
      setSubtasks((current) => [...current, duplicated]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not duplicate subtask.");
    } finally {
      setBusy("");
    }
  }

  async function moveSubtask(subtaskId: string, direction: -1 | 1) {
    const index = subtasks.findIndex((item) => item._id === subtaskId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= subtasks.length) return;
    const next = [...subtasks];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(nextIndex, 0, item);
    setSubtasks(next);
    await callApi(`/api/tasks/${task._id}/subtasks/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ subtasks: next.map((subtask, order) => ({ id: subtask._id, order })) }),
    });
    void refreshSubtasks();
  }

  async function applyBulkUpdate() {
    if (selectedIds.length === 0) return;
    const patch: Record<string, string> = {};
    if (bulkStatus) patch.status = bulkStatus;
    if (bulkPriority) patch.priority = bulkPriority;
    if (Object.keys(patch).length === 0 && !bulkAssignee) return;

    setBusy("bulk");
    setError("");
    try {
      if (Object.keys(patch).length > 0) {
        await callApi(`/api/tasks/${task._id}/subtasks/bulk`, {
          method: "PATCH",
          body: JSON.stringify({ subtaskIds: selectedIds, patch }),
        });
      }
      if (bulkAssignee) {
        await callApi(`/api/tasks/${task._id}/subtasks/bulk-assign`, {
          method: "PATCH",
          body: JSON.stringify({ subtaskIds: selectedIds, assignedToUserId: bulkAssignee }),
        });
      }
      setBulkStatus("");
      setBulkPriority("");
      setBulkAssignee("");
      await refreshSubtasks();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not update selected subtasks.");
    } finally {
      setBusy("");
    }
  }

  async function addDependency() {
    if (!draft._id || !dependencyForm.predecessorSubtaskId) return;
    setBusy("dependency");
    setError("");
    try {
      await callApi(`/api/tasks/${task._id}/subtasks/dependencies`, {
        method: "POST",
        body: JSON.stringify({
          predecessorSubtaskId: dependencyForm.predecessorSubtaskId,
          successorSubtaskId: draft._id,
          dependencyType: dependencyForm.dependencyType,
          lagDuration: dependencyForm.lagDuration ? Number(dependencyForm.lagDuration) : null,
        }),
      });
      setDependencyForm({ predecessorSubtaskId: "", dependencyType: "FINISH_TO_START", lagDuration: "" });
      await refreshSubtasks();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not add dependency.");
    } finally {
      setBusy("");
    }
  }

  async function removeDependency(dependencyId: string) {
    setBusy(dependencyId);
    setError("");
    try {
      await callApi(`/api/tasks/${task._id}/subtasks/dependencies/${dependencyId}`, { method: "DELETE" });
      await refreshSubtasks();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not remove dependency.");
    } finally {
      setBusy("");
    }
  }

  function toggleSelected(subtaskId: string) {
    setSelectedIds((current) =>
      current.includes(subtaskId) ? current.filter((id) => id !== subtaskId) : [...current, subtaskId],
    );
  }

  function selectedSubtask() {
    if (!draft._id) return null;
    return subtasks.find((subtask) => subtask._id === draft._id) ?? null;
  }

  function dependencyCell(subtask: TaskRecord) {
    const blockedBy = subtask.blockedBy ?? [];
    if (blockedBy.length === 0) {
      return <span className="text-vega-text-muted">None</span>;
    }

    const incomplete = blockedBy.filter(
      (dependency) => !isDependencyComplete(dependency.predecessorSubtaskId, dependency.dependencyType),
    );

    return (
      <div className="space-y-1">
        <Badge variant={incomplete.length > 0 ? "danger" : "success"}>
          {incomplete.length > 0 ? `Blocked By ${incomplete.length}` : "Ready"}
        </Badge>
        <p className="max-w-52 truncate text-[10px] text-vega-text-muted">
          {blockedBy.map((dependency) => dependencyLabel(dependency.predecessorSubtaskId)).join(", ")}
        </p>
      </div>
    );
  }

  function renderActivity(items: ActivityLogRecord[], emptyText: string) {
    if (activityLoading && activeTab === "Activity") {
      return <p className="text-sm text-vega-text-muted">Loading activity...</p>;
    }
    if (activityError && activeTab === "Activity") {
      return <p className="rounded-md border border-vega-red/25 bg-vega-red/10 p-3 text-xs text-vega-red">{activityError}</p>;
    }
    if (items.length === 0) {
      return <p className="text-sm text-vega-text-muted">{emptyText}</p>;
    }

    return (
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item._id} className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3 break-words">
            <p className="text-sm text-vega-text">{activityMessage(item)}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-vega-text-muted">
              <span>{humanize(item.action)}</span>
              {item.createdAt ? <span>{new Date(item.createdAt).toLocaleString()}</span> : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderAiAssistant() {
    return (
      <Card>
        <CardHeader className="border-b border-vega-border-soft">
          <CardTitle>AI Assistant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3 text-xs text-vega-text-muted">
            AI suggestions are drafts only. Nothing changes until you review the preview and press Apply.
          </div>
          {aiError ? <p className="rounded-md border border-vega-red/25 bg-vega-red/10 p-3 text-xs text-vega-red">{aiError}</p> : null}
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <Textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="Describe the task or the workflow gap to analyze."
              className="min-h-28"
            />
            <div className="grid gap-2">
              <select value={aiMode} onChange={(event) => setAiMode(event.target.value as AiAssistantMode)}>
                {AI_MODES.map((item) => (
                  <option key={item.mode} value={item.mode}>{item.label}</option>
                ))}
              </select>
              <select
                value={aiSubtaskId}
                onChange={(event) => setAiSubtaskId(event.target.value)}
                disabled={aiMode !== "break_down_subtask"}
              >
                <option value="">Select subtask</option>
                {subtasks.map((subtask) => (
                  <option key={subtask._id} value={subtask._id}>
                    {subtask.code ?? subtask._id} {subtask.title}
                  </option>
                ))}
              </select>
              <Button disabled={aiBusy === "proposal" || (aiMode === "break_down_subtask" && !aiSubtaskId)} onClick={() => void requestAiProposal()}>
                {aiBusy === "proposal" ? "Generating..." : "Generate Preview"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {AI_MODES.map((item) => (
              <Button
                key={item.mode}
                variant={aiMode === item.mode ? "primary" : "secondary"}
                size="sm"
                disabled={aiBusy === "proposal" || (item.mode === "break_down_subtask" && !aiSubtaskId)}
                onClick={() => void requestAiProposal(item.mode)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          {!aiProposal ? (
            <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-6 text-center text-sm text-vega-text-muted">
              No AI preview yet.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-vega-text">{aiProposal.summary}</p>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">{aiProposal.source === "ai" ? "AI generated" : "Rule based scan"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setAiProposal(null)}>Cancel</Button>
                    <Button
                      size="sm"
                      disabled={aiBusy === "apply" || (aiProposal.subtasks.length === 0 && aiProposal.dependencies.length === 0 && aiProposal.checklistItems.length === 0)}
                      onClick={() => void applyAiProposal()}
                    >
                      {aiBusy === "apply" ? "Applying..." : "Apply"}
                    </Button>
                  </div>
                </div>
              </div>

              {aiProposal.problems.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-vega-text">Detected Problems</p>
                  {aiProposal.problems.map((problem, index) => (
                    <div key={`${problem.title}-${index}`} className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                      <Badge variant={problem.severity === "danger" ? "danger" : "warning"}>{problem.severity ?? "warning"}</Badge>
                      <p className="mt-2 text-sm font-medium text-vega-text">{problem.title}</p>
                      <p className="mt-1 text-xs text-vega-text-muted">{problem.detail}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {aiProposal.subtasks.length > 0 ? (
                <div className="overflow-x-auto rounded-md border border-vega-border-soft">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-vega-surface-2 text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">
                      <tr>
                        <th className="px-3 py-3">Subtask</th>
                        <th className="px-3 py-3">Priority</th>
                        <th className="px-3 py-3">Stage</th>
                        <th className="px-3 py-3">Effort</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiProposal.subtasks.map((item, index) => (
                        <tr key={`${item.tempId ?? item.title}-${index}`} className="border-t border-vega-border-soft align-top">
                          <td className="min-w-72 px-3 py-3">
                            <Input value={item.title ?? ""} onChange={(event) => updateAiSubtask(index, { title: event.target.value })} />
                            <Textarea
                              value={item.description ?? ""}
                              onChange={(event) => updateAiSubtask(index, { description: event.target.value })}
                              className="mt-2 min-h-20"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <select value={item.priority ?? "MEDIUM"} onChange={(event) => updateAiSubtask(index, { priority: event.target.value as Priority })}>
                              {PRIORITIES.map((priority) => <option key={priority} value={priority}>{humanize(priority)}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <Input value={item.stage ?? ""} onChange={(event) => updateAiSubtask(index, { stage: event.target.value })} />
                          </td>
                          <td className="px-3 py-3">
                            <Input
                              type="number"
                              min={0}
                              step="0.25"
                              value={item.estimatedEffortHours ?? ""}
                              onChange={(event) => updateAiSubtask(index, { estimatedEffortHours: event.target.value ? Number(event.target.value) : null })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {aiProposal.checklistItems.length > 0 ? (
                <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                  <p className="text-xs font-semibold text-vega-text">Checklist Preview</p>
                  <div className="mt-2 space-y-1">
                    {aiProposal.checklistItems.map((item, index) => (
                      <p key={`${item.title}-${index}`} className="text-xs text-vega-text-muted">{index + 1}. {item.title}</p>
                    ))}
                  </div>
                </div>
              ) : null}

              {aiProposal.dependencies.length > 0 ? (
                <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                  <p className="text-xs font-semibold text-vega-text">Dependency Preview</p>
                  <div className="mt-2 space-y-1">
                    {aiProposal.dependencies.map((dependency, index) => (
                      <p key={`${dependency.predecessorSubtaskId ?? dependency.predecessorTempId}-${index}`} className="text-xs text-vega-text-muted">
                        {dependency.predecessorSubtaskId ?? dependency.predecessorTempId ?? dependency.predecessorKey} {"->"} {dependency.successorSubtaskId ?? dependency.successorTempId ?? dependency.successorKey}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderImportWizard() {
    const issues = importPreview?.issues ?? [];
    const visiblePreviewRows = importPreview?.previewRows.slice(0, 20) ?? [];
    const summary = importPreview?.summary;
    const hasErrors = (summary?.errorCount ?? 0) > 0;
    const hasValidRows = (summary?.validRows ?? 0) > 0;

    return (
      <div className="rounded-md border border-vega-border bg-vega-surface-2 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-vega-text">Import Subtasks</h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {IMPORT_STEPS.map((step) => (
                <span
                  key={step}
                  className={`rounded-md border px-2 py-1 text-[10px] ${
                    importStep === step
                      ? "border-vega-purple-border bg-vega-surface-selected text-[#c4b5fd]"
                      : "border-vega-border-soft text-vega-text-muted"
                  }`}
                >
                  {step}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => window.location.assign(`/api/tasks/${task._id}/subtasks/import/template`)}>
              Download Excel Template
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setImportPreview(null);
                setImportMapping({});
                setImportResult(null);
                setImportStep("Upload");
                setImportError("");
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        {importError ? <p className="mt-3 rounded-md border border-vega-red/25 bg-vega-red/10 p-3 text-xs text-vega-red">{importError}</p> : null}

        <div
          className="mt-3 rounded-md border border-dashed border-vega-border p-4"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleImportDrop}
        >
          <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFileChange} disabled={importLoading === "upload"} />
          <p className="mt-2 text-[10px] text-vega-text-muted">
            .xlsx, .xls, .csv | max 5 MB | max 1,000 rows
          </p>
        </div>

        {importPreview ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-vega-border-soft p-3">
                <p className="text-[10px] text-vega-text-muted">File</p>
                <p className="truncate text-xs font-medium text-vega-text">{importPreview.fileName}</p>
              </div>
              <div className="rounded-md border border-vega-border-soft p-3">
                <p className="text-[10px] text-vega-text-muted">Rows</p>
                <p className="text-xs font-medium text-vega-text">{summary?.totalRows ?? 0}</p>
              </div>
              <div className="rounded-md border border-vega-border-soft p-3">
                <p className="text-[10px] text-vega-text-muted">Valid</p>
                <p className="text-xs font-medium text-vega-text">{summary?.validRows ?? 0}</p>
              </div>
              <div className="rounded-md border border-vega-border-soft p-3">
                <p className="text-[10px] text-vega-text-muted">Issues</p>
                <p className="text-xs font-medium text-vega-text">
                  {summary?.errorCount ?? 0} errors, {summary?.warningCount ?? 0} warnings
                </p>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {importPreview.headers.map((header) => (
                <label key={header} className="grid gap-1 text-[10px] font-medium text-vega-text-muted">
                  {header}
                  <select
                    value={importMapping[header] ?? "ignore"}
                    onChange={(event) => {
                      setImportMapping((current) => ({ ...current, [header]: event.target.value as ImportField }));
                      setImportStep("Mapping");
                    }}
                  >
                    {IMPORT_FIELDS.map((field) => (
                      <option key={field.value} value={field.value}>{field.label}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            {visiblePreviewRows.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-vega-border">
                <table className="w-full min-w-[760px] text-xs">
                  <thead className="bg-[#101c28] text-left text-[10px] text-vega-text-muted">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      {importPreview.headers.map((header) => (
                        <th key={header} className="px-3 py-2">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePreviewRows.map((row) => (
                      <tr key={row.rowNumber} className="border-t border-vega-border-soft">
                        <td className="px-3 py-2 text-vega-text-muted">{row.rowNumber}</td>
                        {importPreview.headers.map((header) => (
                          <td key={header} className="max-w-52 truncate px-3 py-2 text-vega-text-secondary">
                            {row.values[header] || "--"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-md border border-vega-border-soft p-3 text-xs text-vega-text-muted">No import rows found.</p>
            )}

            {issues.length > 0 ? (
              <div className="max-h-56 overflow-auto rounded-md border border-vega-border">
                <table className="w-full min-w-[680px] text-xs">
                  <thead className="bg-[#101c28] text-left text-[10px] text-vega-text-muted">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Level</th>
                      <th className="px-3 py-2">Field</th>
                      <th className="px-3 py-2">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map((item, index) => (
                      <tr key={`${item.rowNumber}-${item.field}-${index}`} className="border-t border-vega-border-soft">
                        <td className="px-3 py-2 text-vega-text-muted">{item.rowNumber}</td>
                        <td className="px-3 py-2">
                          <Badge variant={item.level === "error" ? "danger" : "warning"}>{humanize(item.level)}</Badge>
                        </td>
                        <td className="px-3 py-2 text-vega-text-muted">{item.field}</td>
                        <td className="px-3 py-2 text-vega-text-secondary">{item.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {importResult ? (
              <div className="rounded-md border border-vega-green/30 bg-vega-green/10 p-3 text-xs text-vega-text">
                Imported {importResult.importedRows}, skipped {importResult.skippedRows}, dependencies {importResult.dependencyCount}.
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" disabled={importLoading === "validate"} onClick={() => void validateImport()}>
                {importLoading === "validate" ? "Validating..." : "Validate"}
              </Button>
              <Button disabled={importLoading === "execute" || !hasValidRows} onClick={() => void executeImport(true)}>
                {importLoading === "execute" ? "Importing..." : "Import Valid Rows"}
              </Button>
              <Button variant="secondary" disabled={importLoading === "execute" || hasErrors} onClick={() => void executeImport(false)}>
                Import All
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 border-t border-vega-border-soft pt-3">
          <p className="text-xs font-semibold text-vega-text">Import History</p>
          {importHistory.length === 0 ? (
            <p className="mt-2 text-xs text-vega-text-muted">No imports yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {importHistory.map((job) => (
                <div key={job._id} className="grid gap-2 rounded-md border border-vega-border-soft p-2 text-xs md:grid-cols-[1fr_auto_auto]">
                  <span className="truncate text-vega-text-secondary">{job.fileName}</span>
                  <Badge variant={job.status === "imported" ? "success" : job.status === "failed" ? "danger" : "neutral"}>
                    {humanize(job.status)}
                  </Badge>
                  <span className="text-vega-text-muted">
                    {job.summary?.importedRows ?? 0}/{job.summary?.totalRows ?? 0} imported
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderSubtasks() {
    return (
      <Card>
        <CardHeader className="border-b border-vega-border-soft">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Subtasks</CardTitle>
              <p className="mt-1 text-xs text-vega-text-muted">
                {completedCount}/{subtasks.length} completed | {completionPercent}% progress
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setImportOpen((value) => !value)}>
                {importOpen ? "Close Import" : "Import Subtasks"}
              </Button>
              <Button onClick={openCreateDrawer}>Add Subtask</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="rounded-md border border-vega-red/25 bg-vega-red/10 p-3 text-xs text-vega-red">{error}</p> : null}
          {importOpen ? renderImportWizard() : null}
          <div className="grid gap-2 lg:grid-cols-6">
            <Input placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
            </select>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="">All priorities</option>
              {PRIORITIES.map((priority) => <option key={priority} value={priority}>{humanize(priority)}</option>)}
            </select>
            <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
              <option value="">All assignees</option>
              {assigneeOptions.map((user) => <option key={user._id} value={user._id}>{user.fullName}</option>)}
            </select>
            <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
              {[25, 50, 100].map((size) => <option key={size} value={size}>{size} rows</option>)}
            </select>
            <Button variant="secondary" onClick={() => void refreshSubtasks()}>Refresh</Button>
          </div>

          {selectedIds.length > 0 ? (
            <div className="grid gap-2 rounded-md border border-vega-border bg-vega-surface-2 p-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}>
                <option value="">Keep status</option>
                {STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
              </select>
              <select value={bulkPriority} onChange={(event) => setBulkPriority(event.target.value)}>
                <option value="">Keep priority</option>
                {PRIORITIES.map((priority) => <option key={priority} value={priority}>{humanize(priority)}</option>)}
              </select>
              <select value={bulkAssignee} onChange={(event) => setBulkAssignee(event.target.value)}>
                <option value="">Keep assignee</option>
                {assigneeOptions.map((user) => <option key={user._id} value={user._id}>{user.fullName}</option>)}
              </select>
              <Button disabled={busy === "bulk"} onClick={applyBulkUpdate}>
                Apply To {selectedIds.length}
              </Button>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-md border border-vega-border">
            <table className="w-full min-w-[1220px] text-xs">
              <thead className="bg-vega-surface-2 text-left text-[10px] font-medium text-vega-text-muted">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={visibleSubtasks.length > 0 && visibleSubtasks.every((item) => selectedIds.includes(item._id))}
                      onChange={(event) =>
                        setSelectedIds(event.target.checked ? visibleSubtasks.map((item) => item._id) : [])
                      }
                    />
                  </th>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Subtask</th>
                  <th className="px-3 py-3">Assignee</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Start</th>
                  <th className="px-3 py-3">Due</th>
                  <th className="px-3 py-3">Progress</th>
                  <th className="px-3 py-3">Stage</th>
                  <th className="px-3 py-3">Dependency</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubtasks.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-8 text-center text-vega-text-muted">
                      No subtasks found.
                    </td>
                  </tr>
                ) : (
                  visibleSubtasks.map((subtask, index) => (
                    <tr
                      key={subtask._id}
                      className={`h-[54px] border-t border-vega-border-soft align-middle text-vega-text-secondary transition-colors ${
                        contextSubtaskId === subtask._id
                          ? "bg-vega-surface-selected"
                          : "hover:bg-vega-surface-hover"
                      }`}
                    >
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selectedIds.includes(subtask._id)} onChange={() => toggleSelected(subtask._id)} />
                      </td>
                      <td className="px-3 py-3 text-vega-text-muted">{(page - 1) * pageSize + index + 1}</td>
                      <td className="min-w-64 px-3 py-3">
                        <button type="button" className="text-left text-xs font-medium text-vega-text hover:text-[#c4b5fd]" onClick={() => setContextSubtaskId(subtask._id)}>
                          {subtask.title}
                        </button>
                        <p className="mt-1 text-[10px] text-vega-text-muted">{subtask.code ?? "No code"}</p>
                      </td>
                      <td className="px-3 py-3">{displayName(subtask.assignedToUserId)}</td>
                      <td className="px-3 py-3"><Badge variant={statusVariant(subtask.status)}>{humanize(subtask.status)}</Badge></td>
                      <td className="px-3 py-3"><Badge variant={priorityVariant(subtask.priority)}>{humanize(subtask.priority ?? "MEDIUM")}</Badge></td>
                      <td className="px-3 py-3 text-vega-text-muted">{subtask.startAt ? new Date(subtask.startAt).toLocaleDateString() : "--"}</td>
                      <td className="px-3 py-3 text-vega-text-muted">{subtask.dueAt ? new Date(subtask.dueAt).toLocaleDateString() : "--"}</td>
                      <td className="px-3 py-3">
                        <div className="w-28">
                          <div className="flex justify-between text-[10px] text-vega-text-muted">
                            <span>{subtask.progressPercent ?? 0}%</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-sm bg-[#263445]">
                            <div className="h-full rounded-sm bg-vega-blue" style={{ width: `${subtask.progressPercent ?? 0}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-vega-text-muted">{subtask.stage || "--"}</td>
                      <td className="px-3 py-3">{dependencyCell(subtask)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => openEditDrawer(subtask)}>Edit</Button>
                          <Button size="sm" variant="secondary" onClick={() => void moveSubtask(subtask._id, -1)}>Up</Button>
                          <Button size="sm" variant="secondary" onClick={() => void moveSubtask(subtask._id, 1)}>Down</Button>
                          <Button size="sm" variant="secondary" disabled={busy === subtask._id} onClick={() => void duplicateSubtask(subtask._id)}>Copy</Button>
                          <Button size="sm" variant="danger" disabled={busy === subtask._id} onClick={() => void deleteSubtask(subtask._id)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 text-xs text-vega-text-muted sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {filteredSubtasks.length === 0 ? 0 : (page - 1) * pageSize + 1}
              -{Math.min(page * pageSize, filteredSubtasks.length)} of {filteredSubtasks.length}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={currentPage <= 1} onClick={() => setPage(Math.max(1, currentPage - 1))}>
                Previous
              </Button>
              <span className="flex h-8 items-center rounded-md border border-vega-border px-2">
                {page}/{totalPages}
              </span>
              <Button variant="secondary" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(Math.min(totalPages, currentPage + 1))}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex overflow-x-auto border-b border-vega-border-soft">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap px-3 py-3 text-xs font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-vega-purple text-[#c4b5fd]"
                : "text-vega-text-muted hover:text-vega-text-secondary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Overview" ? (
        <Card>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-[10px] text-vega-text-muted">Owner</p><p className="text-xs font-medium text-vega-text">{displayName(task.assignedToUserId)}</p></div>
            <div><p className="text-[10px] text-vega-text-muted">Status</p><p className="text-xs font-medium text-vega-text">{humanize(task.status)}</p></div>
            <div><p className="text-[10px] text-vega-text-muted">Subtasks</p><p className="text-xs font-medium text-vega-text">{subtasks.length}</p></div>
            <div><p className="text-[10px] text-vega-text-muted">Progress</p><p className="text-xs font-medium text-vega-text">{completionPercent}%</p></div>
            {task.description ? <p className="text-sm text-vega-text-muted sm:col-span-2 lg:col-span-4">{task.description}</p> : null}
          </CardContent>
        </Card>
      ) : null}
      {/*
        Subtasks and the context drawer share a row. On lg and up the drawer is a sibling pane, so
        opening it narrows the table rather than covering it (design.md 6.4); below lg the drawer
        renders as a fixed overlay sheet and the table keeps full width.
      */}
      {activeTab === "Subtasks" ? (
        <div className="flex gap-4">
          <div className="min-w-0 flex-1">{renderSubtasks()}</div>
          {contextSubtask ? (
            <SubtaskContextDrawer
              subtask={contextSubtask as unknown as DrawerSubtask}
              assignableUsers={assignableUsers}
              canAssignOthers={canAssignOthers}
              canEdit={canEdit}
              busy={Boolean(busy)}
              onClose={() => setContextSubtaskId(null)}
              onPatch={(patch) => patchSubtask(contextSubtask._id, patch)}
              onAddComment={(body) => addSubtaskComment(contextSubtask._id, body)}
              onToggleChecklistItem={(itemId, completed) =>
                toggleChecklistItem(contextSubtask._id, itemId, completed)
              }
            />
          ) : null}
        </div>
      ) : null}

      {activeTab === "Dependencies" ? (
        <TaskDependenciesPanel
          parentTaskId={task._id}
          subtasks={subtasks as unknown as Parameters<typeof TaskDependenciesPanel>[0]["subtasks"]}
          focusSubtaskId={contextSubtaskId}
          dependencies={allDependencies}
          canEdit={canEdit}
          busy={Boolean(busy)}
          onCreate={createDependency}
          onRemove={removeDependency}
        />
      ) : null}

      {activeTab === "Checklist" ? (
        <TaskChecklistPanel
          items={task.checklist ?? []}
          canEdit={canEdit}
          busy={busy === "checklist"}
          onSave={saveTaskChecklist}
        />
      ) : null}
      {activeTab === "Workflow" ? (
        <TaskWorkflowBuilder
          task={task}
          taskId={task._id}
          subtasks={subtasks}
          assignableUsers={assigneeOptions}
          onOpenSubtask={openEditDrawer}
          onRefresh={refreshSubtasks}
        />
      ) : null}
      {activeTab === "Timeline" ? (
        <TaskTimelineGantt
          taskId={task._id}
          subtasks={subtasks}
          onOpenSubtask={(subtask) => openEditDrawer(subtask as TaskRecord)}
          onRefresh={refreshSubtasks}
        />
      ) : null}
      {activeTab === "AI Assistant" ? renderAiAssistant() : null}
      {activeTab === "Files" ? <Card><CardContent className="text-sm text-vega-text-muted">{subtasks.reduce((count, item) => count + (item.attachments?.length ?? 0), 0)} subtask file link(s).</CardContent></Card> : null}
      {activeTab === "Comments" ? <Card><CardContent className="text-sm text-vega-text-muted">{subtasks.reduce((count, item) => count + (item.comments?.length ?? 0), 0)} subtask comment(s).</CardContent></Card> : null}
      {activeTab === "Activity" ? (
        <Card>
          <CardHeader>
            <CardTitle>Task Activity</CardTitle>
          </CardHeader>
          <CardContent>{renderActivity(taskActivity, "No task activity has been recorded yet.")}</CardContent>
        </Card>
      ) : null}

      {drawerOpen ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-[rgba(2,7,12,0.68)] backdrop-blur-[2px]">
          <div className="h-full w-full max-w-[min(760px,94vw)] overflow-y-auto overflow-x-hidden border-l border-vega-border bg-[#0a141f] shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
            <div className="sticky top-0 z-10 border-b border-vega-border bg-[#0a141f] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  {draft.code ? <p className="text-[10px] text-vega-text-muted">{draft.code}</p> : null}
                  <h3 className="text-base font-semibold text-vega-text">{draft._id ? draft.title || "Edit Subtask" : "Add Subtask"}</h3>
                </div>
                <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Close</Button>
              </div>
            </div>
            <div className="grid gap-4 p-4">
              <Input placeholder="Title" value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} />
              <Textarea placeholder="Description" value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} className="min-h-28" />
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={draft.assignedToUserId} onChange={(event) => setDraft((value) => ({ ...value, assignedToUserId: event.target.value }))}>
                  {assigneeOptions.map((user) => <option key={user._id} value={user._id}>{user.fullName}</option>)}
                </select>
                <select value={draft.status} onChange={(event) => setDraft((value) => ({ ...value, status: event.target.value as SubtaskStatus }))}>
                  {STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
                </select>
                <select value={draft.priority} onChange={(event) => setDraft((value) => ({ ...value, priority: event.target.value as Priority }))}>
                  {PRIORITIES.map((priority) => <option key={priority} value={priority}>{humanize(priority)}</option>)}
                </select>
                <Input placeholder="Stage" value={draft.stage} onChange={(event) => setDraft((value) => ({ ...value, stage: event.target.value }))} />
                <Input type="date" value={draft.startAt} onChange={(event) => setDraft((value) => ({ ...value, startAt: event.target.value }))} />
                <Input type="date" value={draft.dueAt} onChange={(event) => setDraft((value) => ({ ...value, dueAt: event.target.value }))} />
                <Input type="number" min={0} step="0.25" placeholder="Estimated effort" value={draft.estimatedEffortHours} onChange={(event) => setDraft((value) => ({ ...value, estimatedEffortHours: event.target.value }))} />
                <Input type="number" min={0} step="0.25" placeholder="Actual effort" value={draft.actualEffortHours} onChange={(event) => setDraft((value) => ({ ...value, actualEffortHours: event.target.value }))} />
              </div>
              <label className="grid gap-1 text-xs font-medium text-vega-text">
                Progress
                <input type="range" min={0} max={100} value={draft.progressPercent} onChange={(event) => setDraft((value) => ({ ...value, progressPercent: Number(event.target.value) }))} />
                <span className="text-xs text-vega-text-muted">{draft.progressPercent}%</span>
              </label>
              <Input placeholder="Tags, comma separated" value={draft.tagsText} onChange={(event) => setDraft((value) => ({ ...value, tagsText: event.target.value }))} />

              {draft._id ? (
                <Card>
                  <CardHeader><CardTitle>Dependencies</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-vega-text">Blocked By</p>
                      <div className="mt-2 space-y-2">
                        {(selectedSubtask()?.blockedBy ?? []).length === 0 ? (
                          <p className="text-xs text-vega-text-muted">No predecessor dependencies.</p>
                        ) : (
                          (selectedSubtask()?.blockedBy ?? []).map((dependency) => {
                            const complete = isDependencyComplete(dependency.predecessorSubtaskId, dependency.dependencyType);
                            return (
                              <div key={dependency._id} className="flex flex-col gap-2 rounded-md border border-vega-border-soft bg-vega-surface-2 p-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-xs font-medium text-vega-text">
                                    {complete ? "Complete" : "Pending"}: {dependencyLabel(dependency.predecessorSubtaskId)}
                                  </p>
                                  <p className="text-[10px] text-vega-text-muted">
                                    {humanize(dependency.dependencyType)}
                                    {dependency.lagDuration ? ` | lag ${dependency.lagDuration}` : ""}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={busy === dependency._id}
                                  onClick={() => void removeDependency(dependency._id)}
                                >
                                  Remove
                                </Button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-vega-text">Blocking</p>
                      <div className="mt-2 space-y-2">
                        {(selectedSubtask()?.blocking ?? []).length === 0 ? (
                          <p className="text-xs text-vega-text-muted">This subtask is not blocking another subtask.</p>
                        ) : (
                          (selectedSubtask()?.blocking ?? []).map((dependency) => (
                            <div key={dependency._id} className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-2">
                              <p className="text-xs font-medium text-vega-text">
                                {dependencyLabel(dependency.successorSubtaskId)}
                              </p>
                              <p className="text-[10px] text-vega-text-muted">{humanize(dependency.dependencyType)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2 rounded-md border border-vega-border-soft bg-vega-surface-2 p-3 sm:grid-cols-[1fr_1fr_0.7fr_auto]">
                      <select
                        value={dependencyForm.predecessorSubtaskId}
                        onChange={(event) => setDependencyForm((value) => ({ ...value, predecessorSubtaskId: event.target.value }))}
                      >
                        <option value="">Select predecessor</option>
                        {subtasks
                          .filter((subtask) => subtask._id !== draft._id)
                          .map((subtask) => (
                            <option key={subtask._id} value={subtask._id}>
                              {subtask.code ?? subtask._id} {subtask.title}
                            </option>
                          ))}
                      </select>
                      <select
                        value={dependencyForm.dependencyType}
                        onChange={(event) => setDependencyForm((value) => ({ ...value, dependencyType: event.target.value as DependencyType }))}
                      >
                        {DEPENDENCY_TYPES.map((type) => (
                          <option key={type} value={type}>{humanize(type)}</option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Lag"
                        value={dependencyForm.lagDuration}
                        onChange={(event) => setDependencyForm((value) => ({ ...value, lagDuration: event.target.value }))}
                      />
                      <Button disabled={busy === "dependency"} onClick={() => void addDependency()}>
                        Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader><CardTitle>Checklist</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {draft.checklist.map((item, index) => (
                    <div key={item._id ?? index} className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
                      <input type="checkbox" checked={item.completed} onChange={(event) => setDraft((value) => ({ ...value, checklist: value.checklist.map((entry, current) => current === index ? { ...entry, completed: event.target.checked } : entry) }))} />
                      <Input value={item.title} onChange={(event) => setDraft((value) => ({ ...value, checklist: value.checklist.map((entry, current) => current === index ? { ...entry, title: event.target.value } : entry) }))} />
                      <Button variant="secondary" size="sm" onClick={() => setDraft((value) => ({ ...value, checklist: value.checklist.filter((_, current) => current !== index) }))}>Remove</Button>
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" onClick={() => setDraft((value) => ({ ...value, checklist: [...value.checklist, { title: "", completed: false, order: value.checklist.length }] }))}>Add Item</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Files</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {draft.attachments.map((item, index) => (
                    <div key={item._id ?? index} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                      <Input placeholder="Name" value={item.name} onChange={(event) => setDraft((value) => ({ ...value, attachments: value.attachments.map((entry, current) => current === index ? { ...entry, name: event.target.value } : entry) }))} />
                      <Input placeholder="URL" value={item.url} onChange={(event) => setDraft((value) => ({ ...value, attachments: value.attachments.map((entry, current) => current === index ? { ...entry, url: event.target.value } : entry) }))} />
                      <Button variant="secondary" size="sm" onClick={() => setDraft((value) => ({ ...value, attachments: value.attachments.filter((_, current) => current !== index) }))}>Remove</Button>
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" onClick={() => setDraft((value) => ({ ...value, attachments: [...value.attachments, { name: "", url: "" }] }))}>Add File</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {draft.comments.map((item, index) => (
                    <Textarea key={item._id ?? index} value={item.body} onChange={(event) => setDraft((value) => ({ ...value, comments: value.comments.map((entry, current) => current === index ? { ...entry, body: event.target.value } : entry) }))} />
                  ))}
                  <Button variant="secondary" size="sm" onClick={() => setDraft((value) => ({ ...value, comments: [...value.comments, { body: "" }] }))}>Add Comment</Button>
                </CardContent>
              </Card>

              {draft._id ? (
                <Card>
                  <CardHeader><CardTitle>Subtask Activity</CardTitle></CardHeader>
                  <CardContent>{renderActivity(subtaskActivity, "No activity for this subtask yet.")}</CardContent>
                </Card>
              ) : null}

              <div className="flex justify-end gap-2 border-t border-vega-border pt-4">
                <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
                <Button disabled={busy === "save"} onClick={() => void saveDraft()}>{busy === "save" ? "Saving..." : "Save Subtask"}</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

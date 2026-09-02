"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnConnect,
  type OnEdgesDelete,
  type OnNodesChange,
} from "@xyflow/react";
import {
  CheckCircle2,
  Circle,
  Clock3,
  Flag,
  GitBranch,
  GitMerge,
  Milestone,
  Play,
  Plus,
  Square,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

type PopulatedUser = { _id: string; fullName: string; email: string; role?: string };
type WorkflowMode = "design" | "execution";
type LayoutDirection = "TB" | "LR";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type WorkflowNodeType = "SUBTASK" | "MILESTONE" | "APPROVAL" | "CONDITION" | "MERGE" | "WAIT" | "START" | "END";
type ExecutionState = "completed" | "active" | "ready" | "blocked" | "overdue" | "waiting" | "upcoming";

type DependencySubtaskRef = {
  _id: string;
  code?: string;
  title: string;
  status: string;
  workflowNodeType?: WorkflowNodeType;
  workflowDecision?: string;
};

type SubtaskDependency = {
  _id: string;
  predecessorSubtaskId: DependencySubtaskRef | string;
  successorSubtaskId: DependencySubtaskRef | string;
  dependencyType: "FINISH_TO_START" | "START_TO_START" | "FINISH_TO_FINISH";
  lagDuration?: number | null;
  branchKey?: string;
  branchLabel?: string;
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

type ChecklistItem = {
  _id?: string;
  title: string;
  completed: boolean;
  order: number;
};

export type WorkflowStage = {
  key: string;
  name: string;
  color: string;
  collapsed: boolean;
  order: number;
};

export type WorkflowTaskRecord = {
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
  workflowStages?: WorkflowStage[];
};

type WorkflowNodeData = Record<string, unknown> & {
  subtask: WorkflowTaskRecord;
  isMatch: boolean;
  mode: WorkflowMode;
  executionState?: ExecutionState;
  onOpen: (subtask: WorkflowTaskRecord) => void;
};

type StageNodeData = Record<string, unknown> & {
  stage: WorkflowStage;
  count: number;
  mode: WorkflowMode;
  onRename: (key: string, name: string) => void;
  onColor: (key: string, color: string) => void;
  onCollapse: (key: string) => void;
  onMove: (key: string, direction: -1 | 1) => void;
};

type WorkflowNode = Node<WorkflowNodeData, "workflowNode"> | Node<StageNodeData, "stage">;
type WorkflowEdge = Edge<{ dependency?: SubtaskDependency }>;

type TaskWorkflowBuilderProps = {
  task: WorkflowTaskRecord;
  taskId: string;
  subtasks: WorkflowTaskRecord[];
  assignableUsers: PopulatedUser[];
  onOpenSubtask: (subtask: WorkflowTaskRecord) => void;
  onRefresh: () => Promise<void>;
};

type HistorySnapshot = {
  nodes: Array<{ id: string; x: number; y: number; width?: number | null; collapsed?: boolean; group?: string }>;
  stages: WorkflowStage[];
};

type ExecutionListItem = {
  _id: string;
  code?: string;
  title: string;
  status?: string;
  dueAt?: string | null;
  workflowNodeType?: WorkflowNodeType;
  workflowDecision?: string;
  executionState: ExecutionState;
  blockedBy?: Array<{ code?: string; title: string; status?: string }>;
};

type ExecutionSummary = {
  taskProgress: number;
  counts: Record<ExecutionState | "total", number>;
  nextAvailableTasks: ExecutionListItem[];
  blockedTasks: ExecutionListItem[];
  overdueTasks: ExecutionListItem[];
  criticalBlockers: ExecutionListItem[];
  nodes: ExecutionListItem[];
  activity: Array<{
    _id: string;
    action: string;
    createdAt?: string;
    actorId?: PopulatedUser | null;
    details?: Record<string, unknown>;
  }>;
};

const NODE_WIDTH = 280;
const STAGE_WIDTH = 340;
const STAGE_HEADER = 64;
const STAGE_COL_GAP = 380;
const STAGE_ROW_GAP = 156;
const LAYER_GAP_X = 340;
const LAYER_GAP_Y = 190;
const STACK_GAP = 164;
const NODE_TYPES: WorkflowNodeType[] = ["SUBTASK", "MILESTONE", "APPROVAL", "CONDITION", "MERGE", "WAIT", "START", "END"];
const STAGE_COLORS = ["accent", "success", "warning", "danger", "neutral"] as const;

const nodeTypeIcons = {
  SUBTASK: Circle,
  MILESTONE: Milestone,
  APPROVAL: CheckCircle2,
  CONDITION: GitBranch,
  MERGE: GitMerge,
  WAIT: Clock3,
  START: Play,
  END: Square,
} satisfies Record<WorkflowNodeType, typeof Circle>;

function displayName(user: PopulatedUser | string | null | undefined) {
  if (!user) return "Unassigned";
  if (typeof user === "string") return user;
  return user.fullName || user.email;
}

function initials(user: PopulatedUser | string | null | undefined) {
  const name = displayName(user);
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function formatDate(value?: string | null) {
  if (!value) return "No due date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No due date";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function refId(ref: DependencySubtaskRef | string) {
  return typeof ref === "string" ? ref : ref._id;
}

function normalizeDecision(value?: string | null) {
  return (value ?? "").trim().toUpperCase();
}

function isBranchActive(dependency: SubtaskDependency) {
  const predecessor = typeof dependency.predecessorSubtaskId === "string" ? null : dependency.predecessorSubtaskId;
  const branchKey = normalizeDecision(dependency.branchKey || dependency.branchLabel);
  if (!branchKey) return true;
  if (!["CONDITION", "APPROVAL"].includes(predecessor?.workflowNodeType ?? "")) return true;
  return normalizeDecision(predecessor?.workflowDecision) === branchKey;
}

function stageKey(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function stageColorClass(color: string) {
  if (color === "success") return "border-vega-green/35 bg-vega-green/5";
  if (color === "warning") return "border-vega-yellow/35 bg-vega-yellow/5";
  if (color === "danger") return "border-vega-red/35 bg-vega-red/5";
  if (color === "neutral") return "border-vega-border bg-vega-surface-1/65";
  return "border-vega-purple-border bg-vega-purple/5";
}

function statusTone(status: string) {
  if (status === "COMPLETED") return "bg-vega-green/10 text-[#66dc91] border-vega-green/25";
  if (status === "BLOCKED" || status === "CANCELLED") return "bg-vega-red/10 text-vega-red border-vega-red/25";
  if (status === "REVIEW" || status === "WAITING") return "bg-vega-yellow/10 text-vega-yellow border-vega-yellow/25";
  if (status === "IN_PROGRESS") return "bg-vega-blue-soft text-[#93c5fd] border-vega-blue/25";
  return "bg-vega-surface-2 text-vega-text-muted border-vega-border";
}

function priorityTone(priority?: Priority) {
  if (priority === "URGENT") return "bg-vega-red/15 text-vega-red";
  if (priority === "HIGH") return "bg-vega-orange/15 text-vega-orange";
  if (priority === "LOW") return "bg-vega-surface-2 text-vega-text-muted";
  return "bg-vega-purple-soft text-[#c4b5fd]";
}

function executionTone(state?: ExecutionState) {
  if (state === "completed") return "border-vega-green/60 bg-vega-green/5";
  if (state === "active") return "border-vega-blue bg-vega-blue/5";
  if (state === "ready") return "border-vega-green/50 bg-vega-surface-1";
  if (state === "blocked") return "border-vega-red bg-vega-red/5";
  if (state === "overdue") return "border-vega-red bg-vega-surface-1 ring-2 ring-vega-red/20";
  if (state === "waiting") return "border-vega-yellow bg-vega-yellow/5";
  if (state === "upcoming") return "border-vega-border bg-vega-surface-1 opacity-80";
  return "border-vega-border bg-vega-surface-1";
}

function executionLabel(state?: ExecutionState) {
  if (!state) return "DESIGN";
  return state.toUpperCase();
}

function dependencyEdges(subtasks: WorkflowTaskRecord[]): WorkflowEdge[] {
  return subtasks.flatMap((subtask) =>
    (subtask.blocking ?? []).map((dependency) => {
      const active = isBranchActive(dependency);
      return {
        id: dependency._id,
        source: refId(dependency.predecessorSubtaskId),
        target: refId(dependency.successorSubtaskId),
        type: "smoothstep",
        label: dependency.branchLabel || dependency.branchKey || undefined,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        data: { dependency },
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 6,
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.92 },
        style: { strokeWidth: active ? 2.5 : 1.5, stroke: active ? "#176b87" : "#94a3b8", strokeDasharray: active ? "" : "6 6" },
      };
    }),
  );
}

function normalizeStages(taskStages: WorkflowStage[] | undefined, subtasks: WorkflowTaskRecord[]) {
  const existing = [...(taskStages ?? [])].sort((a, b) => a.order - b.order);
  const byKey = new Map<string, WorkflowStage>();
  existing.forEach((stage, index) => {
    const key = stageKey(stage.key || stage.name);
    if (!key) return;
    byKey.set(key, { ...stage, key, order: index });
  });

  subtasks.forEach((subtask) => {
    const name = subtask.workflowGroup || subtask.stage;
    const key = stageKey(name ?? "");
    if (!key || byKey.has(key)) return;
    byKey.set(key, {
      key,
      name: name ?? key,
      color: "accent",
      collapsed: false,
      order: byKey.size,
    });
  });

  return [...byKey.values()].sort((a, b) => a.order - b.order).map((stage, index) => ({ ...stage, order: index }));
}

function defaultPosition(subtasks: WorkflowTaskRecord[], direction: LayoutDirection): Map<string, { x: number; y: number }> {
  const ids = subtasks.map((subtask) => subtask._id);
  const successors = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  ids.forEach((id) => {
    successors.set(id, []);
    indegree.set(id, 0);
  });

  dependencyEdges(subtasks).forEach((edge) => {
    if (!successors.has(edge.source) || !successors.has(edge.target)) return;
    successors.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  });

  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  const layer = new Map<string, number>();
  queue.forEach((id) => layer.set(id, 0));

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    const currentLayer = layer.get(id) ?? 0;
    successors.get(id)?.forEach((nextId) => {
      layer.set(nextId, Math.max(layer.get(nextId) ?? 0, currentLayer + 1));
      indegree.set(nextId, (indegree.get(nextId) ?? 0) - 1);
      if ((indegree.get(nextId) ?? 0) === 0) queue.push(nextId);
    });
  }

  ids.forEach((id, index) => {
    if (!layer.has(id)) layer.set(id, index);
  });

  const byLayer = new Map<number, string[]>();
  ids.forEach((id) => {
    const value = layer.get(id) ?? 0;
    byLayer.set(value, [...(byLayer.get(value) ?? []), id]);
  });

  const positions = new Map<string, { x: number; y: number }>();
  [...byLayer.entries()].forEach(([layerIndex, layerIds]) => {
    layerIds.forEach((id, index) => {
      positions.set(
        id,
        direction === "LR"
          ? { x: layerIndex * LAYER_GAP_X, y: index * STACK_GAP }
          : { x: index * LAYER_GAP_X, y: layerIndex * LAYER_GAP_Y },
      );
    });
  });

  return positions;
}

function arrangeByStage(subtasks: WorkflowTaskRecord[], stages: WorkflowStage[], direction: LayoutDirection) {
  const positions = new Map<string, { x: number; y: number }>();
  const fallback = defaultPosition(subtasks, direction);
  const stageIndex = new Map(stages.map((stage, index) => [stage.key, index]));
  const usedByStage = new Map<string, number>();

  subtasks.forEach((subtask, index) => {
    const key = stageKey(subtask.workflowGroup || subtask.stage || "");
    if (!stageIndex.has(key)) {
      positions.set(subtask._id, fallback.get(subtask._id) ?? { x: index * 32, y: index * 32 });
      return;
    }

    const offset = usedByStage.get(key) ?? 0;
    usedByStage.set(key, offset + 1);
    const stageOrder = stageIndex.get(key) ?? 0;
    positions.set(
      subtask._id,
      direction === "LR"
        ? { x: stageOrder * STAGE_COL_GAP + 30, y: STAGE_HEADER + offset * STAGE_ROW_GAP }
        : { x: 30 + offset * 24, y: stageOrder * (STAGE_HEADER + STAGE_ROW_GAP * 3) + STAGE_HEADER + offset * STAGE_ROW_GAP },
    );
  });

  return positions;
}

function makeNodes(
  subtasks: WorkflowTaskRecord[],
  stages: WorkflowStage[],
  mode: WorkflowMode,
  query: string,
  executionById: Map<string, ExecutionListItem>,
  onOpen: (subtask: WorkflowTaskRecord) => void,
  stageHandlers: Pick<StageNodeData, "onRename" | "onColor" | "onCollapse" | "onMove">,
): WorkflowNode[] {
  const fallback = arrangeByStage(subtasks, stages, "TB");
  const collapsed = new Set(stages.filter((stage) => stage.collapsed).map((stage) => stage.key));
  const normalizedQuery = query.trim().toLowerCase();

  const stageNodes: WorkflowNode[] = stages.map((stage, index) => {
    const members = subtasks.filter((subtask) => stageKey(subtask.workflowGroup || subtask.stage || "") === stage.key);
    const maxY = Math.max(...members.map((subtask) => subtask.workflowPositionY ?? 0), 0);
    return {
      id: `stage:${stage.key}`,
      type: "stage",
      position: { x: index * STAGE_COL_GAP, y: 0 },
      data: { stage, count: members.length, mode, ...stageHandlers },
      selectable: false,
      draggable: false,
      zIndex: -1,
      style: { width: STAGE_WIDTH, height: stage.collapsed ? 86 : Math.max(360, maxY + 210) },
    };
  });

  const taskNodes: WorkflowNode[] = subtasks
    .filter((subtask) => !collapsed.has(stageKey(subtask.workflowGroup || subtask.stage || "")))
    .map((subtask) => {
      const fallbackPosition = fallback.get(subtask._id) ?? { x: 0, y: 0 };
      const isMatch =
        normalizedQuery.length > 0 &&
        [subtask.code, subtask.title, displayName(subtask.assignedToUserId), subtask.stage, subtask.workflowNodeType]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return {
        id: subtask._id,
        type: "workflowNode",
        position: {
          x: typeof subtask.workflowPositionX === "number" ? subtask.workflowPositionX : fallbackPosition.x,
          y: typeof subtask.workflowPositionY === "number" ? subtask.workflowPositionY : fallbackPosition.y,
        },
        data: { subtask, isMatch, mode, executionState: executionById.get(subtask._id)?.executionState, onOpen },
        width: subtask.workflowWidth ?? NODE_WIDTH,
        zIndex: 2,
      };
    });

  return [...stageNodes, ...taskNodes];
}

function snapshotFromNodes(nodes: WorkflowNode[], stages: WorkflowStage[]): HistorySnapshot {
  return {
    stages,
    nodes: nodes
      .filter((node): node is Node<WorkflowNodeData, "workflowNode"> => node.type === "workflowNode")
      .map((node) => ({
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        width: node.width ?? NODE_WIDTH,
        collapsed: node.data.subtask.workflowCollapsed ?? false,
        group: node.data.subtask.workflowGroup ?? "",
      })),
  };
}

function WorkflowSubtaskNode({ data, selected }: NodeProps<Node<WorkflowNodeData, "workflowNode">>) {
  const subtask = data.subtask;
  const progress = Math.max(0, Math.min(100, subtask.progressPercent ?? 0));
  const NodeIcon = nodeTypeIcons[subtask.workflowNodeType ?? "SUBTASK"];

  return (
    <button
      type="button"
      onClick={() => data.onOpen(subtask)}
      className={cn(
        "group w-[175px] rounded-md border p-2.5 text-left shadow-[0_10px_28px_rgba(0,0,0,0.28)] transition",
        data.mode === "execution" ? executionTone(data.executionState) : "border-[#334456] bg-[#101a27]",
        selected ? "border-[#8090a3] shadow-[0_0_0_1px_rgba(255,255,255,0.15)]" : "hover:border-vega-purple-border",
        data.isMatch ? "ring-2 ring-vega-purple/45" : "",
      )}
    >
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !border-2 !border-vega-bg !bg-vega-purple" />
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 gap-2">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-vega-purple-soft text-[#c4b5fd]">
            <NodeIcon size={15} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-medium text-[#c4b5fd]">{subtask.code ?? subtask.workflowNodeType ?? "NODE"}</p>
            <p className="mt-1 line-clamp-2 text-xs font-medium text-vega-text">{subtask.title}</p>
          </div>
        </div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-vega-border bg-vega-surface-2 text-[10px] font-semibold text-vega-text-secondary">
          {initials(subtask.assignedToUserId)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", statusTone(subtask.status))}>
          {subtask.status.replaceAll("_", " ")}
        </span>
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", priorityTone(subtask.priority))}>
          {subtask.priority ?? "MEDIUM"}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-vega-text-muted">
        <span className="truncate">{displayName(subtask.assignedToUserId)}</span>
        <span>{formatDate(subtask.dueAt)}</span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-[#263445]">
        <div className="h-full rounded-sm bg-vega-blue" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-1 flex justify-between text-[10px] font-medium text-vega-text-muted">
        <span>{subtask.workflowNodeType ?? "SUBTASK"}</span>
        <span>{data.mode === "execution" ? executionLabel(data.executionState) : `${progress}%`}</span>
      </p>
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-2 !border-vega-bg !bg-vega-purple" />
    </button>
  );
}

function WorkflowStageNode({ data }: NodeProps<Node<StageNodeData, "stage">>) {
  const stage = data.stage;
  return (
    <div className={cn("h-full rounded-md border border-dashed p-3", stageColorClass(stage.color))}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <input
            value={stage.name}
            disabled={data.mode !== "design"}
            onChange={(event) => data.onRename(stage.key, event.target.value)}
            className="w-full bg-transparent text-xs font-semibold tracking-normal text-vega-text outline-none"
          />
          <p className="mt-1 text-[10px] text-vega-text-muted">{data.count} node(s)</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" className="rounded border border-vega-border bg-vega-surface-2 px-2 py-1 text-xs text-vega-text-secondary" onClick={() => data.onMove(stage.key, -1)}>
            Up
          </button>
          <button type="button" className="rounded border border-vega-border bg-vega-surface-2 px-2 py-1 text-xs text-vega-text-secondary" onClick={() => data.onMove(stage.key, 1)}>
            Down
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <select
          value={stage.color}
          disabled={data.mode !== "design"}
          onChange={(event) => data.onColor(stage.key, event.target.value)}
          className="h-8 min-h-8 text-xs"
        >
          {STAGE_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
        </select>
        <button
          type="button"
          className="rounded border border-vega-border bg-vega-surface-2 px-2 py-1 text-xs font-medium text-vega-text-secondary"
          onClick={() => data.onCollapse(stage.key)}
        >
          {stage.collapsed ? "Expand" : "Collapse"}
        </button>
      </div>
    </div>
  );
}

const nodeTypes = { workflowNode: WorkflowSubtaskNode, stage: WorkflowStageNode };

function WorkflowCanvas({ task, taskId, subtasks, assignableUsers, onOpenSubtask, onRefresh }: TaskWorkflowBuilderProps) {
  const reactFlow = useReactFlow<WorkflowNode, WorkflowEdge>();
  const [mode, setMode] = useState<WorkflowMode>("design");
  const [direction, setDirection] = useState<LayoutDirection>("TB");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<WorkflowNodeType>("SUBTASK");
  const [newAssignee, setNewAssignee] = useState(assignableUsers[0]?._id ?? "");
  const [newStage, setNewStage] = useState("");
  const [newBranchLabel, setNewBranchLabel] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [executionSummary, setExecutionSummary] = useState<ExecutionSummary | null>(null);
  const initialStages = useMemo(() => normalizeStages(task.workflowStages, subtasks), [task.workflowStages, subtasks]);
  const [stages, setStages] = useState<WorkflowStage[]>(() => initialStages);
  const skipHistoryRef = useRef(false);

  async function callApi<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error ?? "Workflow request failed.");
    return payload?.data as T;
  }

  async function loadExecutionSummary() {
    try {
      const summary = await callApi<ExecutionSummary>(`/api/tasks/${taskId}/subtasks/execution`);
      setExecutionSummary(summary);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load workflow execution.");
    }
  }

  useEffect(() => {
    if (mode !== "execution") return;
    let isCurrent = true;

    fetch(`/api/tasks/${taskId}/subtasks/execution`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error ?? "Workflow request failed.");
        return payload?.data as ExecutionSummary;
      })
      .then((summary) => {
        if (isCurrent) setExecutionSummary(summary);
      })
      .catch((nextError) => {
        if (isCurrent) {
          setError(nextError instanceof Error ? nextError.message : "Could not load workflow execution.");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [mode, subtasks, taskId]);

  const executionById = useMemo(
    () => new Map((executionSummary?.nodes ?? []).map((node) => [node._id, node])),
    [executionSummary],
  );

  const saveWorkflow = useCallback(
    async (nextNodes: WorkflowNode[], nextStages = stages) => {
      const taskNodes = nextNodes.filter((node): node is Node<WorkflowNodeData, "workflowNode"> => node.type === "workflowNode");
      if (taskNodes.length === 0 && nextStages.length === 0) return;
      await callApi(`/api/tasks/${taskId}/subtasks/workflow-layout`, {
        method: "PATCH",
        body: JSON.stringify({
          nodes: taskNodes.map((node) => ({
            id: node.id,
            positionX: Math.round(node.position.x),
            positionY: Math.round(node.position.y),
            width: Math.round(node.width ?? NODE_WIDTH),
            collapsed: node.data.subtask.workflowCollapsed ?? false,
            group: node.data.subtask.workflowGroup ?? "",
          })),
          stages: nextStages.map((stage, order) => ({ ...stage, order })),
        }),
      });
    },
    [stages, taskId],
  );

  const stageHandlers = useMemo(
    () => ({
      onRename: (key: string, name: string) => {
        setStages((current) => current.map((stage) => (stage.key === key ? { ...stage, name } : stage)));
      },
      onColor: (key: string, color: string) => {
        setStages((current) => current.map((stage) => (stage.key === key ? { ...stage, color } : stage)));
      },
      onCollapse: (key: string) => {
        setStages((current) => current.map((stage) => (stage.key === key ? { ...stage, collapsed: !stage.collapsed } : stage)));
      },
      onMove: (key: string, move: -1 | 1) => {
        setStages((current) => {
          const next = [...current].sort((a, b) => a.order - b.order);
          const index = next.findIndex((stage) => stage.key === key);
          const target = index + move;
          if (index < 0 || target < 0 || target >= next.length) return current;
          const [item] = next.splice(index, 1);
          if (!item) return current;
          next.splice(target, 0, item);
          return next.map((stage, order) => ({ ...stage, order }));
        });
      },
    }),
    [],
  );

  const initialNodes = useMemo(
    () => makeNodes(subtasks, stages, mode, search, executionById, onOpenSubtask, stageHandlers),
    [executionById, mode, onOpenSubtask, search, stageHandlers, stages, subtasks],
  );
  const initialEdges = useMemo(() => dependencyEdges(subtasks), [subtasks]);
  const [nodes, setNodes, handleNodesChange] = useNodesState<WorkflowNode>(initialNodes);
  const [edges, setEdges, handleEdgesChange] = useEdgesState<WorkflowEdge>(initialEdges);
  const [history, setHistory] = useState<HistorySnapshot[]>(() =>
    initialNodes.length > 0 ? [snapshotFromNodes(initialNodes, stages)] : [],
  );
  const [historyIndex, setHistoryIndex] = useState(() => (initialNodes.length > 0 ? 0 : -1));

  useEffect(() => {
    setNodes(makeNodes(subtasks, stages, mode, search, executionById, onOpenSubtask, stageHandlers));
    setEdges(dependencyEdges(subtasks));
  }, [executionById, mode, onOpenSubtask, search, setEdges, setNodes, stageHandlers, stages, subtasks]);

  function pushHistory(nextNodes: WorkflowNode[], nextStages = stages) {
    if (skipHistoryRef.current) return;
    const nextSnapshot = snapshotFromNodes(nextNodes, nextStages);
    setHistory((current) => [...current.slice(0, historyIndex + 1), nextSnapshot].slice(-50));
    setHistoryIndex((current) => Math.min(Math.max(current + 1, 0), 49));
  }

  const onNodesChange: OnNodesChange<WorkflowNode> = useCallback(
    (changes) => {
      handleNodesChange(changes);
    },
    [handleNodesChange],
  );

  const onConnect: OnConnect = useCallback(
    async (connection: Connection) => {
      if (mode !== "design" || !connection.source || !connection.target || connection.source.startsWith("stage:")) return;
      setBusy("dependency");
      setError("");
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            label: newBranchLabel.trim() || undefined,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          current,
        ),
      );
      try {
        await callApi(`/api/tasks/${taskId}/subtasks/dependencies`, {
          method: "POST",
          body: JSON.stringify({
            predecessorSubtaskId: connection.source,
            successorSubtaskId: connection.target,
            dependencyType: "FINISH_TO_START",
            branchKey: newBranchLabel.trim(),
            branchLabel: newBranchLabel.trim(),
          }),
        });
        setNewBranchLabel("");
        await onRefresh();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Could not create dependency.");
        await onRefresh();
      } finally {
        setBusy("");
      }
    },
    [mode, newBranchLabel, onRefresh, setEdges, taskId],
  );

  const onEdgesDelete: OnEdgesDelete<WorkflowEdge> = useCallback(
    async (deletedEdges) => {
      if (mode !== "design") return;
      setBusy("dependency");
      setError("");
      try {
        await Promise.all(
          deletedEdges.map((edge) =>
            edge.id.startsWith("stage:")
              ? Promise.resolve()
              : callApi(`/api/tasks/${taskId}/subtasks/dependencies/${edge.id}`, { method: "DELETE" }),
          ),
        );
        await onRefresh();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Could not remove dependency.");
        await onRefresh();
      } finally {
        setBusy("");
      }
    },
    [mode, onRefresh, taskId],
  );

  async function persistCurrentLayout(nextStages = stages) {
    const currentNodes = reactFlow.getNodes();
    pushHistory(currentNodes, nextStages);
    try {
      await saveWorkflow(currentNodes, nextStages);
      await onRefresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save workflow layout.");
    }
  }

  async function saveStages(nextStages = stages) {
    setBusy("stage");
    setError("");
    try {
      await saveWorkflow(reactFlow.getNodes(), nextStages);
      await onRefresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save workflow stages.");
    } finally {
      setBusy("");
    }
  }

  async function autoArrange() {
    setBusy("layout");
    setError("");
    try {
      const positions = stages.length > 0 ? arrangeByStage(subtasks, stages, direction) : defaultPosition(subtasks, direction);
      const arranged = reactFlow.getNodes().map((node) => ({
        ...node,
        position: node.type === "workflowNode" ? positions.get(node.id) ?? node.position : node.position,
      }));
      setNodes(arranged);
      pushHistory(arranged);
      await saveWorkflow(arranged);
      await onRefresh();
      window.requestAnimationFrame(() => reactFlow.fitView({ padding: 0.18, duration: 300 }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not auto arrange workflow.");
    } finally {
      setBusy("");
    }
  }

  async function createStage() {
    const base = `Stage ${stages.length + 1}`;
    const key = stageKey(base);
    const nextStages = [
      ...stages,
      { key, name: base, color: STAGE_COLORS[stages.length % STAGE_COLORS.length], collapsed: false, order: stages.length },
    ];
    setStages(nextStages);
    setNewStage(key);
    await saveStages(nextStages);
  }

  async function moveSelectedToStage(key: string) {
    if (!selectedNodeId || !key) return;
    const stage = stages.find((item) => item.key === key);
    if (!stage) return;
    setBusy("stage");
    setError("");
    try {
      await callApi(`/api/tasks/${taskId}/subtasks/${selectedNodeId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage: stage.name, workflowGroup: stage.key }),
      });
      await onRefresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not move node to stage.");
    } finally {
      setBusy("");
    }
  }

  async function createNode() {
    const title = newTitle.trim();
    if (title.length < 2) {
      setError("Node title is required.");
      return;
    }
    setBusy("create");
    setError("");
    try {
      const stage = stages.find((item) => item.key === newStage);
      const created = await callApi<WorkflowTaskRecord>(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        body: JSON.stringify({
          title,
          assignedToUserId: newAssignee || undefined,
          status: newType === "START" ? "READY" : "NOT_STARTED",
          priority: newType === "MILESTONE" ? "HIGH" : "MEDIUM",
          progressPercent: 0,
          workflowNodeType: newType,
          workflowGroup: stage?.key ?? "",
          stage: stage?.name ?? "",
        }),
      });
      const viewport = reactFlow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      await callApi(`/api/tasks/${taskId}/subtasks/workflow-layout`, {
        method: "PATCH",
        body: JSON.stringify({
          nodes: [{ id: created._id, positionX: Math.round(viewport.x), positionY: Math.round(viewport.y), width: NODE_WIDTH }],
          stages,
        }),
      });
      setNewTitle("");
      await onRefresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create workflow node.");
    } finally {
      setBusy("");
    }
  }

  async function deleteSelectedNode() {
    if (!selectedNodeId) return;
    setBusy("delete");
    setError("");
    try {
      await callApi(`/api/tasks/${taskId}/subtasks/${selectedNodeId}`, { method: "DELETE" });
      setSelectedNodeId("");
      await onRefresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete workflow node.");
    } finally {
      setBusy("");
    }
  }

  async function updateSelectedExecution(patch: { status?: string; workflowDecision?: string }) {
    if (!selectedNodeId) return;
    setBusy("execution");
    setError("");
    try {
      await callApi(`/api/tasks/${taskId}/subtasks/${selectedNodeId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await onRefresh();
      await loadExecutionSummary();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not update workflow execution.");
    } finally {
      setBusy("");
    }
  }

  async function applySnapshot(snapshot: HistorySnapshot) {
    skipHistoryRef.current = true;
    setStages(snapshot.stages);
    const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
    const nextNodes = reactFlow.getNodes().map((node) => {
      const saved = byId.get(node.id);
      return saved && node.type === "workflowNode" ? { ...node, position: { x: saved.x, y: saved.y }, width: saved.width ?? NODE_WIDTH } : node;
    });
    setNodes(nextNodes);
    await saveWorkflow(nextNodes, snapshot.stages);
    await onRefresh();
    skipHistoryRef.current = false;
  }

  async function undo() {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    await applySnapshot(history[nextIndex]);
  }

  async function redo() {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    await applySnapshot(history[nextIndex]);
  }

  const selectedSubtask = subtasks.find((subtask) => subtask._id === selectedNodeId);
  const selectedExecution = selectedNodeId ? executionById.get(selectedNodeId) : null;

  function renderExecutionList(title: string, items: ExecutionListItem[]) {
    return (
      <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <Badge variant={items.length > 0 ? "accent" : "neutral"}>{items.length}</Badge>
        </div>
        <div className="mt-3 max-h-44 space-y-2 overflow-auto">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here.</p>
          ) : (
            items.map((item) => (
              <button
                key={item._id}
                type="button"
                className="w-full rounded-md border border-border bg-surface-soft px-2 py-2 text-left hover:border-accent/45"
                onClick={() => setSelectedNodeId(item._id)}
              >
                <p className="truncate text-sm font-semibold text-foreground">{item.code ?? item.workflowNodeType ?? "NODE"} | {item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{executionLabel(item.executionState)} | {formatDate(item.dueAt)}</p>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("overflow-hidden", fullscreen ? "fixed inset-0 z-50 rounded-none" : "")}>
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle>Workflow</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {subtasks.length} node(s) | {edges.length} dependency edge(s) | {stages.length} stage(s)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search nodes" className="h-9 w-44" />
            <select value={mode} onChange={(event) => setMode(event.target.value as WorkflowMode)} className="h-9 px-2 text-sm">
              <option value="design">Design Mode</option>
              <option value="execution">Execution Mode</option>
            </select>
            <select value={direction} onChange={(event) => setDirection(event.target.value as LayoutDirection)} className="h-9 px-2 text-sm">
              <option value="TB">Top to Bottom</option>
              <option value="LR">Left to Right</option>
            </select>
            <Button size="sm" variant="secondary" onClick={() => reactFlow.fitView({ padding: 0.18, duration: 300 })}>Fit View</Button>
            <Button size="sm" variant="secondary" disabled={busy === "layout"} onClick={() => void autoArrange()}>Auto Arrange</Button>
            <Button size="sm" variant="secondary" disabled={historyIndex <= 0} onClick={() => void undo()}>Undo</Button>
            <Button size="sm" variant="secondary" disabled={historyIndex >= history.length - 1} onClick={() => void redo()}>Redo</Button>
            <Button size="sm" variant="secondary" onClick={() => setFullscreen((value) => !value)}>
              {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-0">
        {error ? <div className="m-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div> : null}
        {mode === "design" ? (
          <div className="flex flex-col gap-2 border-b border-border/70 p-3 xl:flex-row xl:items-center">
            <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="New node title" className="h-9 xl:max-w-xs" />
            <select value={newType} onChange={(event) => setNewType(event.target.value as WorkflowNodeType)} className="h-9 px-2 text-sm">
              {NODE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select value={newStage} onChange={(event) => setNewStage(event.target.value)} className="h-9 px-2 text-sm">
              <option value="">No Stage</option>
              {stages.map((stage) => <option key={stage.key} value={stage.key}>{stage.name}</option>)}
            </select>
            <select value={newAssignee} onChange={(event) => setNewAssignee(event.target.value)} className="h-9 px-2 text-sm">
              {assignableUsers.map((user) => <option key={user._id} value={user._id}>{user.fullName}</option>)}
            </select>
            <Input value={newBranchLabel} onChange={(event) => setNewBranchLabel(event.target.value)} placeholder="Edge label: YES / NO" className="h-9 xl:max-w-44" />
            <Button size="sm" disabled={busy === "create"} onClick={() => void createNode()}>
              <Plus size={15} className="mr-1" /> Add Node
            </Button>
            <Button size="sm" variant="secondary" disabled={busy === "stage"} onClick={() => void createStage()}>
              <Flag size={15} className="mr-1" /> Stage
            </Button>
            <Button size="sm" variant="secondary" disabled={busy === "stage"} onClick={() => void saveStages()}>
              Save Stages
            </Button>
            <Button size="sm" variant="danger" disabled={!selectedNodeId || busy === "delete"} onClick={() => void deleteSelectedNode()}>
              Delete Node
            </Button>
            {selectedSubtask ? (
              <select
                value={stageKey(selectedSubtask.workflowGroup || selectedSubtask.stage || "")}
                onChange={(event) => void moveSelectedToStage(event.target.value)}
                className="h-9 px-2 text-sm"
              >
                <option value="">Move To Stage</option>
                {stages.map((stage) => <option key={stage.key} value={stage.key}>{stage.name}</option>)}
              </select>
            ) : null}
            {selectedSubtask ? <Badge variant="neutral">Selected: {selectedSubtask.code ?? selectedSubtask.title}</Badge> : null}
          </div>
        ) : null}
        {mode === "execution" ? (
          <div className="space-y-3 border-b border-border/70 p-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              {(["completed", "active", "ready", "blocked", "overdue", "waiting", "upcoming"] as ExecutionState[]).map((state) => (
                <div key={state} className="rounded-lg border border-border bg-vega-surface-1 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{executionLabel(state)}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{executionSummary?.counts[state] ?? 0}</p>
                </div>
              ))}
              <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Progress</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{executionSummary?.taskProgress ?? 0}%</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
              <Button size="sm" variant="secondary" disabled={busy === "execution"} onClick={() => void loadExecutionSummary()}>
                Refresh Execution
              </Button>
              <Button size="sm" disabled={!selectedNodeId || busy === "execution"} onClick={() => void updateSelectedExecution({ status: "IN_PROGRESS" })}>
                Mark Active
              </Button>
              <Button size="sm" variant="secondary" disabled={!selectedNodeId || busy === "execution"} onClick={() => void updateSelectedExecution({ status: "COMPLETED" })}>
                Complete
              </Button>
              <Button size="sm" variant="secondary" disabled={!selectedNodeId || busy === "execution"} onClick={() => void updateSelectedExecution({ status: "WAITING" })}>
                Waiting
              </Button>
              <Button size="sm" variant="secondary" disabled={!selectedNodeId || busy === "execution"} onClick={() => void updateSelectedExecution({ workflowDecision: "YES" })}>
                YES
              </Button>
              <Button size="sm" variant="secondary" disabled={!selectedNodeId || busy === "execution"} onClick={() => void updateSelectedExecution({ workflowDecision: "NO" })}>
                NO
              </Button>
              <Button size="sm" variant="secondary" disabled={!selectedNodeId || busy === "execution"} onClick={() => void updateSelectedExecution({ workflowDecision: "APPROVED", status: "COMPLETED" })}>
                Approved
              </Button>
              <Button size="sm" variant="secondary" disabled={!selectedNodeId || busy === "execution"} onClick={() => void updateSelectedExecution({ workflowDecision: "REJECTED", status: "COMPLETED" })}>
                Rejected
              </Button>
              {selectedExecution ? (
                <Badge variant="accent">
                  {selectedSubtask?.code ?? "NODE"} | {executionLabel(selectedExecution.executionState)}
                  {selectedExecution.workflowDecision ? ` | ${selectedExecution.workflowDecision}` : ""}
                </Badge>
              ) : null}
            </div>
            <div className="grid gap-3 lg:grid-cols-4">
              {renderExecutionList("Next Available Tasks", executionSummary?.nextAvailableTasks ?? [])}
              {renderExecutionList("Blocked Tasks", executionSummary?.blockedTasks ?? [])}
              {renderExecutionList("Overdue Tasks", executionSummary?.overdueTasks ?? [])}
              {renderExecutionList("Critical Blockers", executionSummary?.criticalBlockers ?? [])}
            </div>
            <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
              <p className="text-sm font-semibold text-foreground">Execution Activity</p>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {(executionSummary?.activity ?? []).slice(0, 6).map((item) => (
                  <div key={item._id} className="rounded-md bg-surface-soft px-3 py-2 text-sm">
                    <p className="font-semibold text-foreground">{item.action.replaceAll("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {displayName(item.actorId)} | {item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}
                    </p>
                  </div>
                ))}
                {(executionSummary?.activity ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No execution activity yet.</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className={cn("h-[660px] bg-surface-soft", fullscreen ? "h-[calc(100vh-178px)]" : "")}>
          {subtasks.length === 0 && stages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Add a stage or node to begin building this workflow.
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              onEdgesDelete={onEdgesDelete}
              onNodeDragStop={() => void persistCurrentLayout()}
              onNodeClick={(_, node) => node.type === "workflowNode" && setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId("")}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              nodesDraggable={mode === "design"}
              nodesConnectable={mode === "design"}
              elementsSelectable
              deleteKeyCode={mode === "design" ? ["Backspace", "Delete"] : null}
              minZoom={0.1}
              maxZoom={2.2}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#cbd5e1" />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                nodeStrokeWidth={3}
                nodeColor={(node) => {
                  if (node.type === "stage") return "#d8e0ea";
                  const status = (node.data as WorkflowNodeData).subtask.status;
                  if (status === "COMPLETED") return "#207a50";
                  if (status === "BLOCKED" || status === "CANCELLED") return "#be3b45";
                  if (status === "IN_PROGRESS") return "#176b87";
                  return "#94a3b8";
                }}
              />
            </ReactFlow>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function TaskWorkflowBuilder(props: TaskWorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas {...props} />
    </ReactFlowProvider>
  );
}

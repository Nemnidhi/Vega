"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, GitBranch, GripHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type PopulatedUser = { _id: string; fullName: string; email: string; role?: string };
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type GroupBy = "stage" | "assignee" | "status";
type Scale = "day" | "week" | "month";

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
  dependencyType: "FINISH_TO_START" | "START_TO_START" | "FINISH_TO_FINISH";
  branchKey?: string;
  branchLabel?: string;
};

export type TimelineTaskRecord = {
  _id: string;
  code?: string;
  title: string;
  status: string;
  priority?: Priority;
  assignedToUserId: PopulatedUser | string;
  startAt?: string | null;
  dueAt?: string | null;
  progressPercent?: number;
  stage?: string;
  workflowNodeType?: string;
  blockedBy?: SubtaskDependency[];
  blocking?: SubtaskDependency[];
};

type TaskTimelineGanttProps = {
  taskId: string;
  subtasks: TimelineTaskRecord[];
  onOpenSubtask: (subtask: TimelineTaskRecord) => void;
  onRefresh: () => Promise<void>;
};

const ROW_HEIGHT = 52;
const DAY_WIDTH = 34;
const WEEK_WIDTH = 58;
const MONTH_WIDTH = 86;

function displayName(user: PopulatedUser | string | null | undefined) {
  if (!user) return "Unassigned";
  if (typeof user === "string") return user;
  return user.fullName || user.email;
}

function refId(ref: DependencySubtaskRef | string) {
  return typeof ref === "string" ? ref : ref._id;
}

function dayStart(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dayStart(date);
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function diffDays(from: Date, to: Date) {
  return Math.round((dayStart(to).getTime() - dayStart(from).getTime()) / 86_400_000);
}

function formatDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "--";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatInputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function durationDays(subtask: TimelineTaskRecord) {
  const start = parseDate(subtask.startAt);
  const due = parseDate(subtask.dueAt);
  if (!start || !due) return 0;
  return Math.max(1, diffDays(start, due) + 1);
}

function statusTone(subtask: TimelineTaskRecord) {
  const overdue = isOverdue(subtask);
  if (subtask.workflowNodeType === "MILESTONE") return "bg-warning";
  if (overdue) return "bg-danger";
  if (subtask.status === "COMPLETED") return "bg-success";
  if (subtask.status === "IN_PROGRESS" || subtask.status === "REVIEW") return "bg-accent";
  if (subtask.status === "BLOCKED") return "bg-danger";
  if (subtask.status === "WAITING") return "bg-warning";
  return "bg-muted-foreground";
}

function isOverdue(subtask: TimelineTaskRecord) {
  const due = parseDate(subtask.dueAt);
  if (!due || subtask.status === "COMPLETED" || subtask.status === "CANCELLED") return false;
  return due.getTime() < dayStart(new Date()).getTime();
}

function dependencyLabel(subtask: TimelineTaskRecord) {
  const dependencies = subtask.blockedBy ?? [];
  if (dependencies.length === 0) return "None";
  return dependencies
    .map((dependency) => {
      const predecessor = dependency.predecessorSubtaskId;
      return typeof predecessor === "string" ? predecessor.slice(-6) : predecessor.code ?? predecessor.title;
    })
    .join(", ");
}

function groupKey(subtask: TimelineTaskRecord, groupBy: GroupBy) {
  if (groupBy === "assignee") return displayName(subtask.assignedToUserId);
  if (groupBy === "status") return subtask.status.replaceAll("_", " ");
  return subtask.stage || "No Stage";
}

function buildRange(subtasks: TimelineTaskRecord[], scale: Scale) {
  const dates = subtasks.flatMap((subtask) => [parseDate(subtask.startAt), parseDate(subtask.dueAt)]).filter(Boolean) as Date[];
  const today = dayStart(new Date());
  const min = dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : today;
  const max = dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : addDays(today, 14);
  const start = addDays(min, -3);
  const end = addDays(max, 7);
  const step = scale === "month" ? 30 : scale === "week" ? 7 : 1;
  const width = scale === "month" ? MONTH_WIDTH : scale === "week" ? WEEK_WIDTH : DAY_WIDTH;
  const ticks: Date[] = [];
  for (let current = start; current <= end; current = addDays(current, step)) {
    ticks.push(new Date(current));
  }
  return { start, end, step, width, ticks };
}

function buildCriticalPath(subtasks: TimelineTaskRecord[]) {
  const durationById = new Map(subtasks.map((subtask) => [subtask._id, Math.max(1, durationDays(subtask))]));
  const successors = new Map<string, string[]>();
  subtasks.forEach((subtask) => {
    successors.set(subtask._id, []);
  });
  subtasks.forEach((subtask) => {
    (subtask.blocking ?? []).forEach((dependency) => {
      const successorId = refId(dependency.successorSubtaskId);
      if (successors.has(subtask._id) && durationById.has(successorId)) {
        successors.set(subtask._id, [...(successors.get(subtask._id) ?? []), successorId]);
      }
    });
  });

  const memo = new Map<string, number>();
  function score(id: string): number {
    if (memo.has(id)) return memo.get(id) ?? 0;
    const next = successors.get(id) ?? [];
    const value = (durationById.get(id) ?? 1) + Math.max(0, ...next.map(score));
    memo.set(id, value);
    return value;
  }

  let current = subtasks[0]?._id ?? "";
  subtasks.forEach((subtask) => {
    if (score(subtask._id) > score(current)) current = subtask._id;
  });

  const critical = new Set<string>();
  while (current) {
    critical.add(current);
    const next = (successors.get(current) ?? []).sort((a, b) => score(b) - score(a))[0];
    current = next ?? "";
  }
  return critical;
}

export function TaskTimelineGantt({ taskId, subtasks, onOpenSubtask, onRefresh }: TaskTimelineGanttProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>("stage");
  const [scale, setScale] = useState<Scale>("week");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const dragRef = useRef<{ id: string; startX: number; daysPerPixel: number; originalStart: Date | null; originalDue: Date | null } | null>(null);

  const range = useMemo(() => buildRange(subtasks, scale), [scale, subtasks]);
  const criticalPath = useMemo(() => buildCriticalPath(subtasks), [subtasks]);
  const rowIndex = useMemo(() => new Map(subtasks.map((subtask, index) => [subtask._id, index])), [subtasks]);
  const grouped = useMemo(() => {
    const groups = new Map<string, TimelineTaskRecord[]>();
    subtasks.forEach((subtask) => {
      const key = groupKey(subtask, groupBy);
      groups.set(key, [...(groups.get(key) ?? []), subtask]);
    });
    return [...groups.entries()];
  }, [groupBy, subtasks]);

  async function callApi<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error ?? "Timeline request failed.");
    return payload?.data as T;
  }

  async function rescheduleSubtask(subtask: TimelineTaskRecord, nextStart: Date | null, nextDue: Date | null, shiftDependents: boolean) {
    setBusy(subtask._id);
    setError("");
    try {
      await callApi(`/api/tasks/${taskId}/subtasks/${subtask._id}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({
          startAt: nextStart ? formatInputDate(nextStart) : null,
          dueAt: nextDue ? formatInputDate(nextDue) : null,
          shiftDependents,
        }),
      });
      await onRefresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not reschedule subtask.");
    } finally {
      setBusy("");
    }
  }

  function onDragStart(event: React.PointerEvent<HTMLButtonElement>, subtask: TimelineTaskRecord) {
    const start = parseDate(subtask.startAt);
    const due = parseDate(subtask.dueAt);
    if (!start || !due) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: subtask._id,
      startX: event.clientX,
      daysPerPixel: range.step / range.width,
      originalStart: start,
      originalDue: due,
    };
  }

  async function onDragEnd(event: React.PointerEvent<HTMLButtonElement>, subtask: TimelineTaskRecord) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.id !== subtask._id || !drag.originalStart || !drag.originalDue) return;
    const deltaDays = Math.round((event.clientX - drag.startX) * drag.daysPerPixel);
    if (deltaDays === 0) return;
    const nextStart = addDays(drag.originalStart, deltaDays);
    const nextDue = addDays(drag.originalDue, deltaDays);
    const impactedCount = new Set((subtask.blocking ?? []).map((dependency) => refId(dependency.successorSubtaskId))).size;
    const shiftDependents =
      impactedCount > 0 ? window.confirm("Shift dependent tasks automatically?") : false;
    await rescheduleSubtask(subtask, nextStart, nextDue, shiftDependents);
  }

  function barStyle(subtask: TimelineTaskRecord) {
    const start = parseDate(subtask.startAt) ?? parseDate(subtask.dueAt) ?? range.start;
    const due = parseDate(subtask.dueAt) ?? start;
    const left = Math.max(0, (diffDays(range.start, start) / range.step) * range.width);
    const width = Math.max(18, ((diffDays(start, due) + 1) / range.step) * range.width);
    return { left, width };
  }

  const timelineWidth = Math.max(720, range.ticks.length * range.width);
  const todayLeft = (diffDays(range.start, dayStart(new Date())) / range.step) * range.width;
  const nextAvailable = subtasks.filter((subtask) => subtask.status === "READY");
  const delayedItems = subtasks.filter(isOverdue);
  const blockedTasks = subtasks.filter((subtask) => subtask.status === "BLOCKED");
  const workload = [...new Map(subtasks.map((subtask) => [displayName(subtask.assignedToUserId), 0]))].map(([assignee]) => ({
    assignee,
    active: subtasks.filter((subtask) => displayName(subtask.assignedToUserId) === assignee && ["READY", "IN_PROGRESS", "REVIEW"].includes(subtask.status)).length,
  })).filter((item) => item.active >= 5);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Timeline / Gantt</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{subtasks.length} scheduled item(s) from real subtasks and dependencies.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={groupBy} onChange={(event) => setGroupBy(event.target.value as GroupBy)} className="h-9 px-2 text-sm">
              <option value="stage">Group: Stage</option>
              <option value="assignee">Group: Assignee</option>
              <option value="status">Group: Status</option>
            </select>
            <select value={scale} onChange={(event) => setScale(event.target.value as Scale)} className="h-9 px-2 text-sm">
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
            <Button size="sm" variant="secondary" onClick={() => void onRefresh()}>Refresh</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div> : null}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-auto rounded-lg border border-border bg-vega-surface-1">
            <div className="grid min-w-[1120px] grid-cols-[520px_minmax(720px,1fr)]">
              <div className="sticky left-0 z-20 grid grid-cols-[170px_95px_82px_78px_72px_72px_68px_100px] border-b border-border bg-surface-soft px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                <span>Subtask</span><span>Assignee</span><span>Status</span><span>Priority</span><span>Start</span><span>Due</span><span>Duration</span><span>Dependencies</span>
              </div>
              <div className="relative border-b border-border bg-surface-soft" style={{ width: timelineWidth }}>
                <div className="flex">
                  {range.ticks.map((tick) => (
                    <div key={tick.toISOString()} className="border-l border-border px-2 py-2 text-xs font-semibold text-muted-foreground" style={{ width: range.width }}>
                      {scale === "month" ? tick.toLocaleDateString(undefined, { month: "short" }) : tick.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  ))}
                </div>
              </div>

              {grouped.map(([group, items]) => (
                <div key={group} className="contents">
                  <div className="sticky left-0 z-10 col-span-2 border-y border-border bg-surface-soft px-3 py-2 text-xs font-bold uppercase text-foreground">
                    {group}
                  </div>
                  {items.map((subtask) => {
                    const bar = barStyle(subtask);
                    const critical = criticalPath.has(subtask._id);
                    const progress = Math.max(0, Math.min(100, subtask.progressPercent ?? 0));
                    return (
                      <div key={subtask._id} className="contents">
                        <button
                          type="button"
                          onClick={() => onOpenSubtask(subtask)}
                          className="sticky left-0 z-10 grid grid-cols-[170px_95px_82px_78px_72px_72px_68px_100px] items-center gap-0 border-b border-border bg-vega-surface-1 px-3 text-left text-xs hover:bg-surface-soft"
                          style={{ height: ROW_HEIGHT }}
                        >
                          <span className="truncate font-semibold text-foreground">{subtask.code ?? "NODE"} | {subtask.title}</span>
                          <span className="truncate text-muted-foreground">{displayName(subtask.assignedToUserId)}</span>
                          <span className="truncate">{subtask.status.replaceAll("_", " ")}</span>
                          <span>{subtask.priority ?? "MEDIUM"}</span>
                          <span>{formatDate(subtask.startAt)}</span>
                          <span>{formatDate(subtask.dueAt)}</span>
                          <span>{durationDays(subtask)}d</span>
                          <span className="truncate">{dependencyLabel(subtask)}</span>
                        </button>
                        <div className="relative border-b border-border" style={{ height: ROW_HEIGHT, width: timelineWidth }}>
                          {range.ticks.map((tick) => (
                            <div key={tick.toISOString()} className="absolute top-0 h-full border-l border-border/70" style={{ left: (diffDays(range.start, tick) / range.step) * range.width }} />
                          ))}
                          <button
                            type="button"
                            disabled={busy === subtask._id}
                            onPointerDown={(event) => onDragStart(event, subtask)}
                            onPointerUp={(event) => void onDragEnd(event, subtask)}
                            className={cn(
                              "absolute top-3 h-6 overflow-hidden rounded-md text-left text-[11px] font-semibold text-white shadow-sm",
                              statusTone(subtask),
                              critical ? "ring-2 ring-warning ring-offset-1" : "",
                              subtask.workflowNodeType === "MILESTONE" ? "w-6 rotate-45 rounded-sm" : "",
                            )}
                            style={{ left: bar.left, width: subtask.workflowNodeType === "MILESTONE" ? 24 : bar.width }}
                            title="Drag to reschedule"
                          >
                            <span className={cn("block h-full bg-white/25", subtask.workflowNodeType === "MILESTONE" ? "hidden" : "")} style={{ width: `${progress}%` }} />
                            <GripHorizontal size={14} className="absolute right-1 top-1.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="pointer-events-none relative col-start-2 row-start-2" style={{ width: timelineWidth }}>
                {todayLeft >= 0 && todayLeft <= timelineWidth ? (
                  <div className="absolute top-0 h-[2000px] border-l-2 border-danger" style={{ left: todayLeft }}>
                    <span className="ml-1 rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">Today</span>
                  </div>
                ) : null}
                <svg className="absolute left-0 top-0 h-[2000px]" width={timelineWidth} height={2000}>
                  {subtasks.flatMap((subtask) =>
                    (subtask.blocking ?? []).map((dependency) => {
                      const successorId = refId(dependency.successorSubtaskId);
                      const sourceRow = rowIndex.get(subtask._id);
                      const targetRow = rowIndex.get(successorId);
                      const sourceBar = barStyle(subtask);
                      const successor = subtasks.find((item) => item._id === successorId);
                      if (sourceRow === undefined || targetRow === undefined || !successor) return null;
                      const targetBar = barStyle(successor);
                      const y1 = sourceRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                      const y2 = targetRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                      const x1 = sourceBar.left + sourceBar.width;
                      const x2 = targetBar.left;
                      return (
                        <path
                          key={dependency._id}
                          d={`M ${x1} ${y1} C ${x1 + 24} ${y1}, ${x2 - 24} ${y2}, ${x2} ${y2}`}
                          fill="none"
                          stroke="#176b87"
                          strokeWidth="1.5"
                          strokeDasharray={dependency.branchLabel || dependency.branchKey ? "4 4" : undefined}
                        />
                      );
                    }),
                  )}
                </svg>
              </div>
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><CalendarDays size={16} /> Execution Insights</div>
              <div className="mt-3 space-y-3 text-sm">
                <Insight title="Next Available Tasks" items={nextAvailable.map((item) => item.title)} />
                <Insight title="Delayed Items" items={delayedItems.map((item) => item.title)} danger />
                <Insight title="Blocked Tasks" items={blockedTasks.map((item) => item.title)} danger />
                <Insight title="Workload Issues" items={workload.map((item) => `${item.assignee}: ${item.active} active`)} />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-vega-surface-1 p-3 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-semibold text-foreground"><GitBranch size={16} /> Timeline Signals</div>
              <p>Critical path bars use a warning ring. Milestones render as compact diamonds. Dependency lines come from real subtask dependencies.</p>
            </div>
          </aside>
        </div>
      </CardContent>
    </Card>
  );
}

function Insight({ title, items, danger = false }: { title: string; items: string[]; danger?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-foreground">{title}</p>
        <Badge variant={danger && items.length > 0 ? "danger" : "neutral"}>{items.length}</Badge>
      </div>
      <div className="mt-1 space-y-1">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">None</p>
        ) : (
          items.slice(0, 5).map((item) => (
            <p key={item} className={cn("flex items-center gap-1 text-xs", danger ? "text-danger" : "text-muted-foreground")}>
              {danger ? <AlertTriangle size={12} /> : null}
              {item}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

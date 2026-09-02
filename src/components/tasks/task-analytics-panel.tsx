"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PopulatedUser = { _id: string; fullName: string; email: string; role: string };

type AnalyticsPoint = {
  label: string;
  value: number;
};

type StageProgress = {
  label: string;
  total: number;
  completed: number;
  percent: number;
};

type WorkloadRow = {
  userId: string;
  name: string;
  role: string;
  assigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  estimatedWorkloadHours: number;
  capacityHours: number;
  capacityPercent: number;
  capacityLabel: string;
};

type TeamWorkloadRow = {
  team: string;
  assigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  estimatedWorkloadHours: number;
  capacityHours: number;
  capacityPercent: number;
  capacityLabel: string;
};

type TaskAnalytics = {
  options: {
    projects: { id: string; label: string }[];
    stages: string[];
    users: PopulatedUser[];
  };
  metrics: {
    totalTasks: number;
    totalSubtasks: number;
    completed: number;
    inProgress: number;
    blocked: number;
    overdue: number;
    averageCompletionTimeDays: number | null;
    projectCompletionPercent: number;
    dependencies: number;
  };
  charts: {
    completionTrend: AnalyticsPoint[];
    statusDistribution: AnalyticsPoint[];
    priorityDistribution: AnalyticsPoint[];
    teamWorkload: AnalyticsPoint[];
    overdueTrend: AnalyticsPoint[];
    stageProgress: StageProgress[];
    taskVelocity: AnalyticsPoint[];
  };
  workload: {
    users: WorkloadRow[];
    teams: TeamWorkloadRow[];
  };
};

type FilterState = {
  projectId: string;
  userId: string;
  status: string;
  priority: string;
  startDate: string;
  endDate: string;
  stage: string;
};

type TaskAnalyticsPanelProps = {
  assignableUsers: PopulatedUser[];
  currentUserId: string;
  currentUserRole: string;
};

const STATUSES = [
  "todo",
  "in_progress",
  "done",
  "NOT_STARTED",
  "READY",
  "IN_PROGRESS",
  "WAITING",
  "BLOCKED",
  "REVIEW",
  "COMPLETED",
  "CANCELLED",
] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildQuery(filters: FilterState) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

async function fetchAnalytics(filters: FilterState) {
  const query = buildQuery(filters);
  const response = await fetch(`/api/tasks/analytics${query ? `?${query}` : ""}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload?.error?.message ?? "Could not load task analytics.");
  }
  return payload.data as TaskAnalytics;
}

function metricValue(value: number | null, suffix = "") {
  if (value === null) return "N/A";
  return `${value.toLocaleString()}${suffix}`;
}

function MetricCard({ label, value, context }: { label: string; value: string | number; context?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        {context ? <p className="mt-1 text-xs text-muted-foreground">{context}</p> : null}
      </CardContent>
    </Card>
  );
}

function Bars({ items, emptyText }: { items: AnalyticsPoint[]; emptyText: string }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (items.length === 0 || items.every((item) => item.value === 0)) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[92px_1fr_42px] items-center gap-2 text-xs">
          <span className="truncate text-muted-foreground" title={item.label}>{item.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-muted/40">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} />
          </div>
          <span className="text-right font-semibold text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function TrendBars({ items, emptyText }: { items: AnalyticsPoint[]; emptyText: string }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (items.length === 0 || items.every((item) => item.value === 0)) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex h-32 items-end gap-1">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t bg-accent" style={{ height: `${Math.max(8, (item.value / max) * 100)}%` }} title={`${item.label}: ${item.value}`} />
          <span className="max-w-full truncate text-[9px] text-muted-foreground">{item.label.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function StageBars({ items }: { items: StageProgress[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No stage data.</p>;

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-muted-foreground">{item.label}</span>
            <span className="font-semibold text-foreground">{item.completed}/{item.total}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted/40">
            <div className="h-full rounded-full bg-success" style={{ width: `${item.percent}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function workloadVariant(label: string): "success" | "warning" | "danger" | "accent" | "neutral" {
  if (label === "Overallocated") return "danger";
  if (label === "High") return "warning";
  if (label === "Healthy") return "success";
  if (label === "Available") return "accent";
  return "neutral";
}

export function TaskAnalyticsPanel({ assignableUsers, currentUserId, currentUserRole }: TaskAnalyticsPanelProps) {
  const [filters, setFilters] = useState<FilterState>({
    projectId: "",
    userId: "",
    status: "",
    priority: "",
    startDate: "",
    endDate: "",
    stage: "",
  });
  const [analytics, setAnalytics] = useState<TaskAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const canFilterTeam = ["admin", "partner", "project_manager"].includes(currentUserRole);

  const userOptions = useMemo(() => {
    const fromAnalytics = analytics?.options.users ?? [];
    const merged = new Map<string, PopulatedUser>();
    [...assignableUsers, ...fromAnalytics].forEach((user) => merged.set(user._id, user));
    return [...merged.values()].sort((first, second) => first.fullName.localeCompare(second.fullName));
  }, [analytics?.options.users, assignableUsers]);

  useEffect(() => {
    let active = true;

    async function load() {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setError("");
      try {
        const data = await fetchAnalytics(filters);
        if (active) setAnalytics(data);
      } catch (nextError) {
        if (active) setError(nextError instanceof Error ? nextError.message : "Could not load task analytics.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [filters, refreshKey]);

  function updateFilter(key: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters({
      projectId: "",
      userId: "",
      status: "",
      priority: "",
      startDate: "",
      endDate: "",
      stage: "",
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Task Analytics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-6">
          <select
            value={filters.projectId}
            onChange={(event) => updateFilter("projectId", event.target.value)}
            className="h-11 rounded-xl border border-border/90 bg-vega-surface-1 px-3.5 text-sm text-foreground"
          >
            <option value="">All projects</option>
            {(analytics?.options.projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>{project.label}</option>
            ))}
          </select>
          <select
            value={filters.userId}
            onChange={(event) => updateFilter("userId", event.target.value)}
            className="h-11 rounded-xl border border-border/90 bg-vega-surface-1 px-3.5 text-sm text-foreground"
          >
            <option value="">{canFilterTeam ? "All members" : "My work"}</option>
            {canFilterTeam ? userOptions.map((user) => (
              <option key={user._id} value={user._id}>{user.fullName}</option>
            )) : <option value={currentUserId}>My work</option>}
          </select>
          <select
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
            className="h-11 rounded-xl border border-border/90 bg-vega-surface-1 px-3.5 text-sm text-foreground"
          >
            <option value="">All statuses</option>
            {STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
          </select>
          <select
            value={filters.priority}
            onChange={(event) => updateFilter("priority", event.target.value)}
            className="h-11 rounded-xl border border-border/90 bg-vega-surface-1 px-3.5 text-sm text-foreground"
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((priority) => <option key={priority} value={priority}>{humanize(priority)}</option>)}
          </select>
          <Input type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} />
          <Input type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} />
          <select
            value={filters.stage}
            onChange={(event) => updateFilter("stage", event.target.value)}
            className="h-11 rounded-xl border border-border/90 bg-vega-surface-1 px-3.5 text-sm text-foreground lg:col-span-2"
          >
            <option value="">All stages</option>
            {(analytics?.options.stages ?? []).map((stage) => <option key={stage} value={stage}>{stage}</option>)}
          </select>
          <div className="flex gap-2 lg:col-span-4">
            <Button variant="secondary" onClick={() => setRefreshKey((value) => value + 1)}>Refresh</Button>
            <Button variant="secondary" onClick={clearFilters}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-danger/35 bg-danger/5">
          <CardContent className="p-3 text-sm text-danger">{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading analytics...</CardContent>
        </Card>
      ) : null}

      {!loading && analytics ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Tasks" value={analytics.metrics.totalTasks} />
            <MetricCard label="Total Subtasks" value={analytics.metrics.totalSubtasks} />
            <MetricCard label="Completed" value={analytics.metrics.completed} />
            <MetricCard label="In Progress" value={analytics.metrics.inProgress} />
            <MetricCard label="Blocked" value={analytics.metrics.blocked} />
            <MetricCard label="Overdue" value={analytics.metrics.overdue} />
            <MetricCard label="Avg Completion" value={metricValue(analytics.metrics.averageCompletionTimeDays, "d")} />
            <MetricCard label="Project Completion" value={`${analytics.metrics.projectCompletionPercent}%`} context={`${analytics.metrics.dependencies} dependency link(s)`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Completion Trend</CardTitle></CardHeader>
              <CardContent><TrendBars items={analytics.charts.completionTrend} emptyText="No completed work in this range." /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Overdue Trend</CardTitle></CardHeader>
              <CardContent><TrendBars items={analytics.charts.overdueTrend} emptyText="No overdue work in this range." /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Status Distribution</CardTitle></CardHeader>
              <CardContent><Bars items={analytics.charts.statusDistribution} emptyText="No status data." /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Priority Distribution</CardTitle></CardHeader>
              <CardContent><Bars items={analytics.charts.priorityDistribution} emptyText="No priority data." /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Team Workload</CardTitle></CardHeader>
              <CardContent><Bars items={analytics.charts.teamWorkload} emptyText="No active workload." /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Task Velocity</CardTitle></CardHeader>
              <CardContent><TrendBars items={analytics.charts.taskVelocity} emptyText="No velocity data." /></CardContent>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader><CardTitle>Stage Progress</CardTitle></CardHeader>
              <CardContent><StageBars items={analytics.charts.stageProgress} /></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Workload Analysis</CardTitle></CardHeader>
            <CardContent>
              {analytics.workload.users.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assigned workload for the selected filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-border/70 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3">Member</th>
                        <th className="px-3 py-3">Assigned</th>
                        <th className="px-3 py-3">Completed</th>
                        <th className="px-3 py-3">In Progress</th>
                        <th className="px-3 py-3">Overdue</th>
                        <th className="px-3 py-3">Estimated</th>
                        <th className="px-3 py-3">Capacity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.workload.users.map((row) => (
                        <tr key={row.userId} className="border-b border-border/60">
                          <td className="px-3 py-3">
                            <p className="font-semibold text-foreground">{row.name}</p>
                            <p className="text-[10px] capitalize text-muted-foreground">{row.role.replaceAll("_", " ")}</p>
                          </td>
                          <td className="px-3 py-3">{row.assigned}</td>
                          <td className="px-3 py-3">{row.completed}</td>
                          <td className="px-3 py-3">{row.inProgress}</td>
                          <td className="px-3 py-3">{row.overdue}</td>
                          <td className="px-3 py-3">{row.estimatedWorkloadHours}h</td>
                          <td className="px-3 py-3">
                            <Badge variant={workloadVariant(row.capacityLabel)}>{row.capacityPercent}% {row.capacityLabel}</Badge>
                            <p className="mt-1 text-[10px] text-muted-foreground">{row.capacityHours}h capacity</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {analytics.workload.teams.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Team Capacity</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {analytics.workload.teams.map((team) => (
                  <div key={team.team} className="rounded-lg border border-border/70 bg-vega-surface-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold capitalize text-foreground">{team.team}</p>
                      <Badge variant={workloadVariant(team.capacityLabel)}>{team.capacityPercent}%</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{team.capacityLabel}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {team.assigned} assigned | {team.estimatedWorkloadHours}h estimated
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

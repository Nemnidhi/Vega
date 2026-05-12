import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { ProjectAssignmentBoard } from "@/components/projects/project-assignment-board";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { getDevelopers, getProjectByIdForActor } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

type Params = Promise<{ projectId: string }>;

type ProjectPageUserRef = {
  _id: string;
  fullName: string;
  email: string;
  role?: string;
  status?: string;
};

type ProjectPageTask = {
  _id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  assignedDeveloperId?: ProjectPageUserRef | string | null;
  completedByDeveloperId?: ProjectPageUserRef | string | null;
  completedAt?: string | null;
  completionAlertPending?: boolean;
  createdAt?: string | null;
};

type ProjectPageItem = {
  _id: string;
  title: string;
  description?: string;
  status: "planned" | "in_progress" | "on_hold" | "completed";
  assignedDeveloperId?: ProjectPageUserRef | string | null;
  tasks: ProjectPageTask[];
  updatedAt?: string | null;
};

type FlowNodeState = "done" | "active" | "pending" | "alert";
type FlowNodeItem = {
  key: string;
  step: string;
  label: string;
  value: string;
  metricLabel: string;
  metricValue: string;
  note: string;
  state: FlowNodeState;
};

type FlowNodePalette = {
  fill: string;
  stroke: string;
  label: string;
  metricFill: string;
  metricText: string;
  dot: string;
};

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatDate(value?: string | null) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString("en-IN");
}

function getTaskBadgeVariant(
  status: ProjectPageTask["status"],
): "neutral" | "warning" | "accent" | "success" | "danger" {
  if (status === "done") {
    return "success";
  }
  if (status === "blocked") {
    return "danger";
  }
  if (status === "in_progress") {
    return "accent";
  }
  return "warning";
}

function getProjectBadgeVariant(
  status: ProjectPageItem["status"],
): "neutral" | "warning" | "accent" | "success" | "danger" {
  if (status === "completed") {
    return "success";
  }
  if (status === "on_hold") {
    return "danger";
  }
  if (status === "in_progress") {
    return "accent";
  }
  return "warning";
}

function resolveUserLabel(value: ProjectPageUserRef | string | null | undefined) {
  if (!value) {
    return "Unassigned";
  }
  if (typeof value === "string") {
    return value;
  }
  return value.fullName ? `${value.fullName} (${value.email})` : value.email;
}

function getFlowNodeContainerClasses(state: FlowNodeState) {
  if (state === "done") {
    return "border-success/35 bg-success/10 shadow-sm";
  }
  if (state === "active") {
    return "border-accent/40 bg-accent/10 shadow-sm";
  }
  if (state === "alert") {
    return "border-danger/45 bg-danger/10 shadow-sm";
  }
  return "border-border/80 bg-white shadow-sm";
}

function getFlowNodeBadgeClasses(state: FlowNodeState) {
  if (state === "done") {
    return "border-success/45 bg-success/15 text-success";
  }
  if (state === "active") {
    return "border-accent/45 bg-accent/15 text-accent";
  }
  if (state === "alert") {
    return "border-danger/50 bg-danger/15 text-danger";
  }
  return "border-border/80 bg-surface-soft text-muted-foreground";
}

function getFlowNodeDotClasses(state: FlowNodeState) {
  if (state === "done") {
    return "bg-success";
  }
  if (state === "active") {
    return "bg-accent";
  }
  if (state === "alert") {
    return "bg-danger";
  }
  return "bg-muted-foreground/35";
}

function getFlowNodePalette(state: FlowNodeState): FlowNodePalette {
  if (state === "done") {
    return {
      fill: "#eaf9f0",
      stroke: "#1f9d68",
      label: "#155a3d",
      metricFill: "#d8f3e4",
      metricText: "#155a3d",
      dot: "#1f9d68",
    };
  }
  if (state === "active") {
    return {
      fill: "#e9f4fc",
      stroke: "#14618f",
      label: "#113f5c",
      metricFill: "#d9ebfa",
      metricText: "#113f5c",
      dot: "#14618f",
    };
  }
  if (state === "alert") {
    return {
      fill: "#ffeceb",
      stroke: "#cc3d3d",
      label: "#8f2626",
      metricFill: "#ffd8d5",
      metricText: "#8f2626",
      dot: "#cc3d3d",
    };
  }
  return {
    fill: "#f6f7f9",
    stroke: "#9ba6b4",
    label: "#5f6976",
    metricFill: "#eceff3",
    metricText: "#5f6976",
    dot: "#9ba6b4",
  };
}

export default async function ProjectDetailPage({ params }: { params: Params }) {
  const session = await requireRoleAccess(["admin", "developer"]);
  const { projectId } = await params;

  const [project, developers] = await Promise.all([
    getProjectByIdForActor({
      role: session.role,
      userId: session.userId,
    }, projectId),
    session.role === "admin" ? getDevelopers() : Promise.resolve([]),
  ]);

  const selectedProject = project as ProjectPageItem | null;

  if (!selectedProject) {
    notFound();
  }

  const tasks = selectedProject.tasks ?? [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const inProgressTasks = tasks.filter((task) => task.status === "in_progress").length;
  const blockedTasks = tasks.filter((task) => task.status === "blocked").length;
  const todoTasks = tasks.filter((task) => task.status === "todo").length;
  const pendingAlerts = tasks.filter((task) => task.completionAlertPending).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const remainingTasks = Math.max(totalTasks - completedTasks, 0);
  const recentTasks = [...tasks]
    .sort((a, b) => {
      const aTime = new Date(a.completedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.completedAt ?? b.createdAt ?? 0).getTime();
      return bTime - aTime;
    })
    .slice(0, 5);
  const plannedNodeState: FlowNodeState =
    selectedProject.status === "planned" ? "active" : "done";
  const queueNodeState: FlowNodeState =
    todoTasks > 0 && selectedProject.status !== "planned"
      ? "active"
      : selectedProject.status === "planned"
        ? "pending"
        : "done";
  const executionNodeState: FlowNodeState =
    inProgressTasks > 0 ? "active" : completedTasks > 0 ? "done" : "pending";
  const blockerNodeState: FlowNodeState =
    blockedTasks > 0
      ? "alert"
      : selectedProject.status === "on_hold"
        ? "active"
        : inProgressTasks > 0 || completedTasks > 0 || selectedProject.status === "completed"
          ? "done"
          : "pending";
  const deliveryNodeState: FlowNodeState =
    selectedProject.status === "completed" || (completedTasks > 0 && completionRate === 100)
      ? "done"
      : completedTasks > 0
        ? "active"
        : "pending";
  const closureNodeState: FlowNodeState =
    selectedProject.status === "completed"
      ? "done"
      : selectedProject.status === "on_hold"
        ? "alert"
        : "pending";
  const coreFlowNodes: FlowNodeItem[] = [
    {
      key: "planned",
      step: "Step 1",
      label: "Project Planned",
      value: formatStatus(selectedProject.status),
      metricLabel: "Kickoff",
      metricValue: selectedProject.status === "planned" ? "Now" : "Done",
      note: "Planning and owner assignment phase.",
      state: plannedNodeState,
    },
    {
      key: "queue",
      step: "Step 2",
      label: "Task Queue",
      value: `${todoTasks} todo`,
      metricLabel: "Backlog",
      metricValue: `${todoTasks}`,
      note: "Ready tasks waiting for development.",
      state: queueNodeState,
    },
    {
      key: "execution",
      step: "Step 3",
      label: "Execution",
      value: `${inProgressTasks} running`,
      metricLabel: "Working",
      metricValue: `${inProgressTasks}`,
      note: "Developers actively working tasks.",
      state: executionNodeState,
    },
    {
      key: "delivery",
      step: "Step 4",
      label: "Delivery",
      value: `${completedTasks}/${totalTasks} done`,
      metricLabel: "Completion",
      metricValue: `${completionRate}%`,
      note: "Completed tasks move to delivery state.",
      state: deliveryNodeState,
    },
    {
      key: "closure",
      step: "Step 5",
      label: "Project Closed",
      value: selectedProject.status === "completed" ? "Closed" : "Open",
      metricLabel: "Final",
      metricValue: selectedProject.status === "completed" ? "Yes" : "No",
      note: "All work approved and closed.",
      state: closureNodeState,
    },
  ];
  const riskFlowNode: FlowNodeItem = {
    key: "risk",
    step: "Parallel Check",
    label: "Risk And Blockers",
    value: blockedTasks > 0 ? `${blockedTasks} blocked` : "No blockers",
    metricLabel: "Attention",
    metricValue: blockedTasks > 0 ? `${blockedTasks}` : "0",
    note: "Escalate blockers before final delivery.",
    state: blockerNodeState,
  };
  const mobileFlowNodes: FlowNodeItem[] = [
    coreFlowNodes[0]!,
    coreFlowNodes[1]!,
    coreFlowNodes[2]!,
    riskFlowNode,
    coreFlowNodes[3]!,
    coreFlowNodes[4]!,
  ];
  const primaryFlowMessage =
    blockedTasks > 0
      ? `${blockedTasks} blocker(s) need resolution before closure.`
      : selectedProject.status === "on_hold"
        ? "Project is currently on hold. Resume execution to continue flow."
        : completionRate === 100
          ? "Execution fully completed. Project is ready for closure."
          : inProgressTasks > 0
          ? "Execution is active and progressing normally."
            : "Assign tasks and start execution to move this graph forward.";
  const flowNodeWidth = 170;
  const flowNodeHeight = 108;
  const desktopFlowNodes = [
    { ...coreFlowNodes[0]!, x: 30, y: 48 },
    { ...coreFlowNodes[1]!, x: 230, y: 48 },
    { ...coreFlowNodes[2]!, x: 430, y: 48 },
    { ...coreFlowNodes[3]!, x: 630, y: 48 },
    { ...coreFlowNodes[4]!, x: 830, y: 48 },
  ];
  const riskDesktopNode = { ...riskFlowNode, x: 430, y: 240 };
  const executionCenterX = desktopFlowNodes[2]!.x + flowNodeWidth / 2;
  const executionBottomY = desktopFlowNodes[2]!.y + flowNodeHeight;
  const riskTopY = riskDesktopNode.y;
  const riskRightX = riskDesktopNode.x + flowNodeWidth;
  const riskCenterY = riskDesktopNode.y + flowNodeHeight / 2;
  const deliveryCenterX = desktopFlowNodes[3]!.x + flowNodeWidth / 2;
  const deliveryBottomY = desktopFlowNodes[3]!.y + flowNodeHeight;

  return (
    <section className="space-y-4 sm:space-y-6">
      <DashboardHeader
        title={selectedProject.title}
        subtitle="Project details and task assignments."
        showLeadCta={false}
        action={
          session.role === "admin"
            ? {
                label: "Create Project",
                href: "/projects?createProject=1",
              }
            : undefined
        }
      />

      <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        <Link
          href="/projects"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-semibold tracking-wide text-foreground transition-colors hover:bg-surface-soft sm:w-auto"
        >
          Back To Projects
        </Link>
        <Link
          href="#task-assignment"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-semibold tracking-wide text-foreground transition-colors hover:bg-surface-soft sm:w-auto"
        >
          Jump To Task Assignment
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Project Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant={getProjectBadgeVariant(selectedProject.status)}>
              {formatStatus(selectedProject.status)}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Last updated: {formatDate(selectedProject.updatedAt)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Task Completion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold text-foreground">{completionRate}%</p>
            <p className="text-sm text-muted-foreground">
              {completedTasks}/{totalTasks} tasks completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Assigned Developer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{resolveUserLabel(selectedProject.assignedDeveloperId)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{pendingAlerts}</p>
            <p className="text-sm text-muted-foreground">Developer completion alerts awaiting review</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-3 overflow-hidden border-border/80">
          <CardHeader className="space-y-2 border-b border-border/60 bg-surface-soft">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <CardTitle>Execution Flowchart Graph</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Live execution map from planning to closure with blocker branching.
                </p>
              </div>
              <div className="inline-flex items-center rounded-lg border border-accent/25 bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-accent">
                {completionRate}% Complete
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="rounded-2xl border border-border/70 bg-white p-3 sm:p-4">
              <div className="space-y-3 lg:hidden">
                {mobileFlowNodes.map((node, index) => {
                  const isLastNode = index === mobileFlowNodes.length - 1;
                  return (
                    <div key={`mobile-${node.key}`}>
                      <div className={`rounded-xl border px-3 py-3 ${getFlowNodeContainerClasses(node.state)}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              {node.step}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{node.label}</p>
                          </div>
                          <span
                            className={`mt-0.5 h-2.5 w-2.5 rounded-full ${getFlowNodeDotClasses(node.state)}`}
                          />
                        </div>
                        <p className="mt-2 text-sm text-foreground/85">{node.value}</p>
                        <div className="mt-2 flex items-center justify-between rounded-lg border border-border/60 bg-white/90 px-2.5 py-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            {node.metricLabel}
                          </span>
                          <span
                            className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getFlowNodeBadgeClasses(node.state)}`}
                          >
                            {node.metricValue}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{node.note}</p>
                      </div>
                      {isLastNode ? null : (
                        <div className="mx-4 h-4 border-l-2 border-dashed border-border/70" />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="hidden lg:block">
                <svg
                  viewBox="0 0 1040 390"
                  role="img"
                  aria-label="Project execution flowchart"
                  className="h-auto w-full rounded-xl border border-border/70 bg-white"
                >
                  <defs>
                    <marker
                      id="flow-arrow-main"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#5f6976" />
                    </marker>
                    <marker
                      id="flow-arrow-alert"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#cc3d3d" />
                    </marker>
                  </defs>

                  {[200, 400, 600, 800].map((x) => (
                    <line
                      key={`grid-${x}`}
                      x1={x}
                      y1={18}
                      x2={x}
                      y2={372}
                      stroke="#e6e9ee"
                      strokeWidth="1"
                      strokeDasharray="4 8"
                    />
                  ))}

                  {desktopFlowNodes.slice(0, -1).map((node, index) => {
                    const fromX = node.x + flowNodeWidth;
                    const toX = desktopFlowNodes[index + 1]!.x;
                    const y = node.y + flowNodeHeight / 2;
                    return (
                      <line
                        key={`edge-${node.key}-${desktopFlowNodes[index + 1]!.key}`}
                        x1={fromX}
                        y1={y}
                        x2={toX - 8}
                        y2={y}
                        stroke="#5f6976"
                        strokeWidth="2"
                        markerEnd="url(#flow-arrow-main)"
                      />
                    );
                  })}

                  <line
                    x1={executionCenterX}
                    y1={executionBottomY}
                    x2={executionCenterX}
                    y2={riskTopY - 8}
                    stroke="#5f6976"
                    strokeWidth="2"
                    strokeDasharray="7 6"
                    markerEnd="url(#flow-arrow-main)"
                  />
                  <path
                    d={`M ${riskRightX} ${riskCenterY} C ${riskRightX + 54} ${riskCenterY}, ${
                      deliveryCenterX - 30
                    } ${deliveryBottomY + 28}, ${deliveryCenterX} ${deliveryBottomY + 8}`}
                    stroke={blockedTasks > 0 ? "#cc3d3d" : "#5f6976"}
                    strokeWidth="2"
                    strokeDasharray="7 6"
                    fill="none"
                    markerEnd={blockedTasks > 0 ? "url(#flow-arrow-alert)" : "url(#flow-arrow-main)"}
                  />

                  {[...desktopFlowNodes, riskDesktopNode].map((node) => {
                    const palette = getFlowNodePalette(node.state);
                    return (
                      <g key={`node-${node.key}`}>
                        <rect
                          x={node.x}
                          y={node.y}
                          width={flowNodeWidth}
                          height={flowNodeHeight}
                          rx="16"
                          fill={palette.fill}
                          stroke={palette.stroke}
                          strokeWidth="2"
                        />
                        <circle cx={node.x + 14} cy={node.y + 16} r="5" fill={palette.dot} />
                        <text
                          x={node.x + 26}
                          y={node.y + 20}
                          fontSize="10"
                          fontWeight="700"
                          fill={palette.label}
                          style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
                        >
                          {node.step}
                        </text>
                        <text x={node.x + 14} y={node.y + 43} fontSize="13" fontWeight="700" fill="#0f172a">
                          {node.label}
                        </text>
                        <text x={node.x + 14} y={node.y + 61} fontSize="11.5" fill="#334155">
                          {node.value}
                        </text>
                        <rect
                          x={node.x + 14}
                          y={node.y + 74}
                          width="54"
                          height="22"
                          rx="11"
                          fill={palette.metricFill}
                        />
                        <text
                          x={node.x + 41}
                          y={node.y + 89}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="700"
                          fill={palette.metricText}
                        >
                          {node.metricValue}
                        </text>
                        <text x={node.x + 74} y={node.y + 89} fontSize="10.5" fill={palette.label}>
                          {node.metricLabel}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border bg-white px-3 py-2.5">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Open Tasks</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{remainingTasks}</p>
              </div>
              <div className="rounded-lg border border-border bg-white px-3 py-2.5">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">In Progress</p>
                <p className="mt-1 text-lg font-semibold text-accent">{inProgressTasks}</p>
              </div>
              <div className="rounded-lg border border-border bg-white px-3 py-2.5">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Blocked Issues</p>
                <p className="mt-1 text-lg font-semibold text-danger">{blockedTasks}</p>
              </div>
              <div className="rounded-lg border border-border bg-white px-3 py-2.5">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Flow Signal</p>
                <p className="mt-1 text-sm font-medium text-foreground">{primaryFlowMessage}</p>
                <p className="mt-1 text-xs text-muted-foreground">Pending alerts: {pendingAlerts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Execution Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-semibold text-foreground">{completionRate}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-surface-soft">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border bg-white p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Todo</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{todoTasks}</p>
              </div>
              <div className="rounded-lg border border-border bg-white p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">In Progress</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{inProgressTasks}</p>
              </div>
              <div className="rounded-lg border border-border bg-white p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Blocked</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{blockedTasks}</p>
              </div>
              <div className="rounded-lg border border-border bg-white p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Remaining</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{remainingTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Task Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No task activity available yet.</p>
            ) : (
              recentTasks.map((task) => (
                <div key={task._id} className="rounded-lg border border-border bg-white p-3">
                  <p className="text-sm font-semibold text-foreground">{task.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={getTaskBadgeVariant(task.status)}>{formatStatus(task.status)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(task.completedAt ?? task.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div id="task-assignment">
        <ProjectAssignmentBoard
          initialProjects={[selectedProject]}
          developerOptions={developers as Array<{ _id: string; fullName: string; email: string }>}
          canManage={session.role === "admin"}
          currentUserId={session.userId}
          showProjectCards={false}
          showInlineDetails
          initialSelectedProjectId={selectedProject._id}
        />
      </div>
    </section>
  );
}


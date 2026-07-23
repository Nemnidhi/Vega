import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { ProjectAssignmentBoard } from "@/components/projects/project-assignment-board";
import {
  TaskQueueCardTrigger,
  TaskQueueSvgTrigger,
} from "@/components/projects/task-queue-launcher-trigger";
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

function getTaskNodeState(task: ProjectPageTask): FlowNodeState {
  if (task.completionAlertPending || task.status === "blocked") {
    return "alert";
  }
  if (task.status === "done") {
    return "done";
  }
  if (task.status === "in_progress") {
    return "active";
  }
  return "pending";
}

function getTaskProgress(status: ProjectPageTask["status"]) {
  if (status === "done") {
    return 100;
  }
  if (status === "blocked") {
    return 65;
  }
  if (status === "in_progress") {
    return 50;
  }
  return 15;
}

function getTaskTrackingPhase(task: ProjectPageTask) {
  if (task.completionAlertPending) {
    return "Awaiting admin review";
  }
  if (task.status === "done") {
    return "Completed by developer";
  }
  if (task.status === "blocked") {
    return "Blocked and needs attention";
  }
  if (task.status === "in_progress") {
    return "Developer is working";
  }
  return "Assigned and queued";
}

function getTaskStageClasses(
  stage: ProjectPageTask["status"],
  activeStatus: ProjectPageTask["status"],
) {
  const stageOrder: ProjectPageTask["status"][] = ["todo", "in_progress", "blocked", "done"];
  const stageIndex = stageOrder.indexOf(stage);
  const activeIndex = stageOrder.indexOf(activeStatus);

  if (stage === activeStatus) {
    if (stage === "done") return "border-success/45 bg-success/15 text-success";
    if (stage === "blocked") return "border-danger/50 bg-danger/15 text-danger";
    if (stage === "in_progress") return "border-accent/45 bg-accent/15 text-accent";
    return "border-warning/45 bg-warning/15 text-warning";
  }

  if (stageIndex >= 0 && activeIndex >= 0 && stageIndex < activeIndex) {
    return "border-border bg-white text-foreground";
  }

  return "border-border/70 bg-surface-soft text-muted-foreground";
}

function getTaskProgressBarClasses(status: ProjectPageTask["status"]) {
  if (status === "done") return "bg-success";
  if (status === "blocked") return "bg-danger";
  if (status === "in_progress") return "bg-accent";
  return "bg-warning";
}

function getTaskNodeFrameClasses(state: FlowNodeState) {
  if (state === "done") {
    return "border-success/30 bg-[linear-gradient(135deg,#ffffff_0%,#eefaf3_100%)] shadow-sm";
  }
  if (state === "active") {
    return "border-accent/30 bg-[linear-gradient(135deg,#ffffff_0%,#edf7fd_100%)] shadow-sm";
  }
  if (state === "alert") {
    return "border-danger/35 bg-[linear-gradient(135deg,#ffffff_0%,#fff0ee_100%)] shadow-sm";
  }
  return "border-border/80 bg-[linear-gradient(135deg,#ffffff_0%,#f7f8fa_100%)] shadow-sm";
}

function getTaskNodeKickerClasses(state: FlowNodeState) {
  if (state === "done") return "text-success";
  if (state === "active") return "text-accent";
  if (state === "alert") return "text-danger";
  return "text-muted-foreground";
}

function trimSvgText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(maxLength - 3, 0))}...`;
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
  const orderedTasks = [...tasks].sort((a, b) => {
    const aTime = new Date(a.createdAt ?? 0).getTime();
    const bTime = new Date(b.createdAt ?? 0).getTime();
    return aTime - bTime;
  });
  const taskNodeItems = orderedTasks.map((task, index) => ({
    task,
    nodeNumber: index + 1,
    state: getTaskNodeState(task),
    phase: getTaskTrackingPhase(task),
    progress: getTaskProgress(task.status),
    assigneeLabel: resolveUserLabel(task.assignedDeveloperId),
  }));
  const taskStages: ProjectPageTask["status"][] = ["todo", "in_progress", "blocked", "done"];
  const visibleGraphTaskNodes = taskNodeItems.slice(0, 4);
  const hiddenGraphTaskCount = Math.max(taskNodeItems.length - visibleGraphTaskNodes.length, 0);
  const activeTaskNodes = taskNodeItems.filter((node) => node.state === "active").length;
  const reviewTaskNodes = taskNodeItems.filter((node) => node.task.completionAlertPending).length;
  const completedTaskNodes = taskNodeItems.filter((node) => node.state === "done").length;
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
  const nextActionMessage =
    pendingAlerts > 0
      ? "Review completed developer work and acknowledge pending alerts."
      : blockedTasks > 0
        ? "Clear blocked nodes before moving delivery forward."
        : todoTasks > 0
          ? "Move queued nodes into execution as developers start work."
          : totalTasks === 0
            ? "Assign the first developer task to activate the project graph."
            : completionRate === 100
              ? "Close the project once admin review is finished."
              : "Keep monitoring active nodes until delivery is complete.";
  const quickStats = [
    {
      label: "Project Status",
      value: formatStatus(selectedProject.status),
      meta: `Updated ${formatDate(selectedProject.updatedAt)}`,
      className: "border-accent/20 bg-accent/10 text-accent",
    },
    {
      label: "Delivery Progress",
      value: `${completionRate}%`,
      meta: `${completedTasks}/${totalTasks} tasks complete`,
      className: "border-success/20 bg-success/10 text-success",
    },
    {
      label: "Assigned Owner",
      value: resolveUserLabel(selectedProject.assignedDeveloperId),
      meta: `${totalTasks} live task node${totalTasks === 1 ? "" : "s"}`,
      className: "border-border bg-white text-foreground",
    },
    {
      label: "Admin Review",
      value: `${pendingAlerts}`,
      meta: "developer completion alerts",
      className:
        pendingAlerts > 0
          ? "border-danger/25 bg-danger/10 text-danger"
          : "border-border bg-white text-foreground",
    },
  ];
  const executionMetrics = [
    {
      label: "Open Tasks",
      value: remainingTasks,
      meta: `${totalTasks} total`,
      className: "text-foreground",
    },
    {
      label: "Active Nodes",
      value: activeTaskNodes,
      meta: `${inProgressTasks} in progress`,
      className: "text-accent",
    },
    {
      label: "Blocked Issues",
      value: blockedTasks,
      meta: `${reviewTaskNodes} review alerts`,
      className: blockedTasks > 0 ? "text-danger" : "text-foreground",
    },
    {
      label: "Closed Nodes",
      value: completedTaskNodes,
      meta: `${completionRate}% delivered`,
      className: "text-success",
    },
  ];
  const flowNodeWidth = 170;
  const flowNodeHeight = 108;
  const taskGraphNodeWidth = 190;
  const taskGraphNodeHeight = 88;
  const desktopFlowNodes = [
    { ...coreFlowNodes[0]!, x: 30, y: 38 },
    { ...coreFlowNodes[1]!, x: 230, y: 38 },
    { ...coreFlowNodes[2]!, x: 430, y: 38 },
    { ...coreFlowNodes[3]!, x: 630, y: 38 },
    { ...coreFlowNodes[4]!, x: 830, y: 38 },
  ];
  const desktopTaskGraphNodes = visibleGraphTaskNodes.map((item, index) => ({
    ...item,
    x: 120 + index * 225,
    y: 230,
  }));
  const riskDesktopNode = { ...riskFlowNode, x: 430, y: 440 };
  const executionCenterX = desktopFlowNodes[2]!.x + flowNodeWidth / 2;
  const executionBottomY = desktopFlowNodes[2]!.y + flowNodeHeight;
  const riskTopY = riskDesktopNode.y;
  const riskRightX = riskDesktopNode.x + flowNodeWidth;
  const riskCenterY = riskDesktopNode.y + flowNodeHeight / 2;
  const deliveryCenterX = desktopFlowNodes[3]!.x + flowNodeWidth / 2;
  const deliveryBottomY = desktopFlowNodes[3]!.y + flowNodeHeight;
  const taskGraphTopY = 230;
  const taskGraphBottomY = taskGraphTopY + taskGraphNodeHeight;
  const taskGraphRailY = taskGraphTopY - 34;
  const taskGraphExitY = taskGraphBottomY + 34;

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

      <div className="rounded-2xl border border-border/80 bg-[linear-gradient(135deg,#ffffff_0%,#f4f8fb_60%,#edf6fb_100%)] p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
              Live Project Command Center
            </p>
            <h2 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">
              Developer execution is mapped into trackable task nodes.
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{primaryFlowMessage}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{nextActionMessage}</p>
          </div>

          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            <Link
              href="/projects"
              className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-semibold tracking-wide text-foreground transition-colors hover:bg-surface-soft sm:w-auto"
            >
              Back To Projects
            </Link>
            <Link
              href="#task-assignment"
              className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-accent/30 bg-accent px-4 text-sm font-semibold tracking-wide text-white transition-colors hover:bg-accent-strong sm:w-auto"
            >
              Assign / Track Tasks
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickStats.map((stat) => (
            <div
              key={stat.label}
              className={`min-w-0 rounded-xl border px-3.5 py-3 ${stat.className}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-75">
                {stat.label}
              </p>
              <p className="mt-2 truncate text-xl font-semibold">{stat.value}</p>
              <p className="mt-1 text-xs opacity-75">{stat.meta}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-3 overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="space-y-3 border-b border-border/60 bg-[linear-gradient(135deg,#f8fbfd_0%,#ffffff_100%)]">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                  Execution Graph
                </p>
                <CardTitle>Project flow with live developer nodes</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Admin can follow assignment, execution, blocker, delivery, and review states from one map.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-lg border border-accent/25 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-accent">
                  {completionRate}% Complete
                </span>
                <span className="inline-flex items-center rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-foreground">
                  {totalTasks} Nodes
                </span>
                {pendingAlerts > 0 ? (
                  <span className="inline-flex items-center rounded-lg border border-danger/25 bg-danger/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-danger">
                    {pendingAlerts} Review
                  </span>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="rounded-2xl border border-border/70 bg-white p-3 sm:p-4">
              <div className="space-y-3 lg:hidden">
                {mobileFlowNodes.map((node, index) => {
                  const isLastNode = index === mobileFlowNodes.length - 1;
                  const mobileNodeCard = (
                    <div
                      className={`rounded-xl border px-3 py-3 ${
                        node.key === "queue" && session.role === "admin"
                          ? "cursor-pointer ring-1 ring-accent/25 transition hover:border-accent hover:bg-accent/10"
                          : ""
                      } ${getFlowNodeContainerClasses(node.state)}`}
                    >
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
                      <p className="mt-2 text-xs text-muted-foreground">
                        {node.key === "queue" && session.role === "admin"
                          ? "Tap to assign a new task node."
                          : node.note}
                      </p>
                    </div>
                  );
                  return (
                    <div key={`mobile-${node.key}`}>
                      {node.key === "queue" && session.role === "admin" ? (
                        <TaskQueueCardTrigger projectId={selectedProject._id}>
                          {mobileNodeCard}
                        </TaskQueueCardTrigger>
                      ) : (
                        mobileNodeCard
                      )}
                      {isLastNode ? null : (
                        <div className="mx-4 h-4 border-l-2 border-dashed border-border/70" />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="hidden lg:block">
                <svg
                  viewBox="0 0 1040 600"
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

                  <rect x="14" y="14" width="1012" height="130" rx="22" fill="#fbfdff" stroke="#edf1f5" />
                  <rect x="14" y="158" width="1012" height="210" rx="22" fill="#f8fafc" stroke="#e7edf3" />
                  <rect x="344" y="416" width="352" height="136" rx="22" fill="#fbfdff" stroke="#e7edf3" />

                  {[200, 400, 600, 800].map((x) => (
                    <line
                      key={`grid-${x}`}
                      x1={x}
                      y1={18}
                      x2={x}
                      y2={582}
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

                  {desktopTaskGraphNodes.length > 0 ? (
                    <>
                      <text
                        x="30"
                        y="184"
                        fontSize="11"
                        fontWeight="700"
                        fill="#5f6976"
                        style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
                      >
                        Developer Task Nodes
                      </text>
                      {hiddenGraphTaskCount > 0 ? (
                        <text x="850" y="184" fontSize="11" fontWeight="700" fill="#5f6976">
                          +{hiddenGraphTaskCount} more below
                        </text>
                      ) : null}
                        <line
                          x1={executionCenterX}
                          y1={executionBottomY}
                          x2={executionCenterX}
                          y2={taskGraphRailY}
                          stroke="#5f6976"
                          strokeWidth="2"
                          strokeDasharray="7 6"
                        />
                        <line
                          x1={desktopTaskGraphNodes[0]!.x + taskGraphNodeWidth / 2}
                          y1={taskGraphRailY}
                          x2={
                            desktopTaskGraphNodes[desktopTaskGraphNodes.length - 1]!.x +
                            taskGraphNodeWidth / 2
                          }
                          y2={taskGraphRailY}
                          stroke="#5f6976"
                          strokeWidth="2"
                          strokeDasharray="7 6"
                        />
                        {desktopTaskGraphNodes.map((node) => {
                          const centerX = node.x + taskGraphNodeWidth / 2;
                          return (
                            <g key={`task-edge-${node.task._id}`}>
                              <line
                                x1={centerX}
                                y1={taskGraphRailY}
                                x2={centerX}
                                y2={node.y - 8}
                                stroke="#5f6976"
                                strokeWidth="2"
                                strokeDasharray="7 6"
                                markerEnd="url(#flow-arrow-main)"
                              />
                              <line
                          x1={centerX}
                          y1={node.y + taskGraphNodeHeight}
                          x2={centerX}
                          y2={taskGraphExitY - 8}
                                stroke="#5f6976"
                                strokeWidth="2"
                                strokeDasharray="7 6"
                              />
                            </g>
                          );
                        })}
                        <line
                          x1={desktopTaskGraphNodes[0]!.x + taskGraphNodeWidth / 2}
                          y1={taskGraphExitY}
                          x2={
                            desktopTaskGraphNodes[desktopTaskGraphNodes.length - 1]!.x +
                            taskGraphNodeWidth / 2
                          }
                          y2={taskGraphExitY}
                          stroke="#5f6976"
                          strokeWidth="2"
                          strokeDasharray="7 6"
                        />
                        <line
                          x1={executionCenterX}
                          y1={taskGraphExitY}
                          x2={executionCenterX}
                          y2={riskTopY - 8}
                          stroke="#5f6976"
                          strokeWidth="2"
                          strokeDasharray="7 6"
                          markerEnd="url(#flow-arrow-main)"
                        />
                      </>
                    ) : (
                      <>
                        <text
                          x="30"
                          y="178"
                          fontSize="11"
                          fontWeight="700"
                          fill="#5f6976"
                          style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
                        >
                          Developer Task Nodes
                        </text>
                        <rect
                          x="360"
                          y="210"
                          width="320"
                          height="88"
                          rx="16"
                          fill="#f6f7f9"
                          stroke="#cbd5e1"
                          strokeWidth="2"
                          strokeDasharray="7 6"
                        />
                        <text x="520" y="246" textAnchor="middle" fontSize="14" fontWeight="700" fill="#334155">
                          No task nodes yet
                        </text>
                        <text x="520" y="268" textAnchor="middle" fontSize="12" fill="#64748b">
                          Assign a task below to create the first node
                        </text>
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
                      </>
                    )}
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
                    const isTaskQueueAction = node.key === "queue" && session.role === "admin";
                    const nodeGroup = (
                      <g>
                        <rect
                          x={node.x}
                          y={node.y}
                          width={flowNodeWidth}
                          height={flowNodeHeight}
                          rx="16"
                          fill={palette.fill}
                          stroke={isTaskQueueAction ? "#0b4f79" : palette.stroke}
                          strokeWidth={isTaskQueueAction ? "2.5" : "2"}
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
                          {isTaskQueueAction ? "Click to assign" : node.metricLabel}
                        </text>
                      </g>
                    );

                    if (isTaskQueueAction) {
                      return (
                        <TaskQueueSvgTrigger
                          key={`node-${node.key}`}
                          projectId={selectedProject._id}
                        >
                          {nodeGroup}
                        </TaskQueueSvgTrigger>
                      );
                    }

                    return <g key={`node-${node.key}`}>{nodeGroup}</g>;
                  })}
  
                    {desktopTaskGraphNodes.map((node) => {
                      const palette = getFlowNodePalette(node.state);
                      return (
                        <a key={`task-node-${node.task._id}`} href={`#task-${node.task._id}`}>
                          <g>
                            <rect
                              x={node.x}
                              y={node.y}
                              width={taskGraphNodeWidth}
                              height={taskGraphNodeHeight}
                              rx="14"
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
                              TASK {node.nodeNumber}
                            </text>
                            <text x={node.x + 14} y={node.y + 43} fontSize="13" fontWeight="700" fill="#0f172a">
                              {trimSvgText(node.task.title, 24)}
                            </text>
                            <text x={node.x + 14} y={node.y + 61} fontSize="11" fill="#334155">
                              {trimSvgText(node.assigneeLabel, 28)}
                            </text>
                            <rect
                              x={node.x + 14}
                              y={node.y + 70}
                              width="72"
                              height="18"
                              rx="9"
                              fill={palette.metricFill}
                            />
                            <text
                              x={node.x + 50}
                              y={node.y + 83}
                              textAnchor="middle"
                              fontSize="10"
                              fontWeight="700"
                              fill={palette.metricText}
                            >
                              {formatStatus(node.task.status)}
                            </text>
                            <text x={node.x + 94} y={node.y + 83} fontSize="10" fill={palette.label}>
                              {node.progress}%
                            </text>
                          </g>
                        </a>
                      );
                    })}
                  </svg>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-[linear-gradient(135deg,#ffffff_0%,#f7fafc_100%)] p-3 shadow-sm sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Live Developer Task Nodes</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Every assignment becomes a real node with owner, state, progress, and review signal.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex w-fit rounded-lg border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-accent">
                      {totalTasks} Nodes
                    </span>
                    <span className="inline-flex w-fit rounded-lg border border-success/20 bg-success/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-success">
                      {completedTaskNodes} Closed
                    </span>
                  </div>
                </div>

                {taskNodeItems.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-border bg-surface-soft/70 px-3 py-5 text-center text-sm text-muted-foreground">
                    No developer task nodes yet. Assign the first task below and it will appear here immediately.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {taskNodeItems.map((node) => (
                      <a
                        key={`live-task-node-${node.task._id}`}
                        href={`#task-${node.task._id}`}
                        className={`group block rounded-xl border p-3 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md ${getTaskNodeFrameClasses(node.state)}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p
                              className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${getTaskNodeKickerClasses(node.state)}`}
                            >
                              Node {node.nodeNumber} / {formatStatus(node.task.status)}
                            </p>
                            <p className="mt-1 break-words text-sm font-semibold text-foreground">
                              {node.task.title}
                            </p>
                          </div>
                          <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${getFlowNodeDotClasses(node.state)}`} />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant={getTaskBadgeVariant(node.task.status)}>
                            {formatStatus(node.task.status)}
                          </Badge>
                          {node.task.completionAlertPending ? (
                            <Badge variant="danger">Admin Review</Badge>
                          ) : null}
                        </div>

                        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                          <p>Developer: {node.assigneeLabel}</p>
                          <p>Signal: {node.phase}</p>
                          <p>Created: {formatDate(node.task.createdAt)}</p>
                          {node.task.completedAt ? (
                            <p>Completed: {formatDate(node.task.completedAt)}</p>
                          ) : null}
                        </div>

                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Node progress</span>
                            <span className="font-semibold text-foreground">{node.progress}%</span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-white/80">
                            <div
                              className={`h-full rounded-full transition-all ${getTaskProgressBarClasses(node.task.status)}`}
                              style={{ width: `${node.progress}%` }}
                            />
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                          {taskStages.map((stage) => (
                            <span
                              key={`${node.task._id}-${stage}`}
                              className={`rounded-md border px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] ${getTaskStageClasses(stage, node.task.status)}`}
                            >
                              {formatStatus(stage)}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] font-semibold text-foreground">
                          <span>Open task row</span>
                          <span className="text-accent transition-transform group-hover:translate-x-1">
                            View
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {executionMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-lg border border-border bg-white px-3 py-2.5 shadow-sm"
                  >
                    <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className={`mt-1 text-lg font-semibold ${metric.className}`}>
                      {metric.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{metric.meta}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-accent/20 bg-accent/10 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">
                  Flow Signal
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">{primaryFlowMessage}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Next action: {nextActionMessage}
                </p>
              </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Execution Health</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Status mix across every live developer node.
                </p>
              </div>
              <Badge variant={blockedTasks > 0 ? "danger" : completionRate === 100 ? "success" : "accent"}>
                {blockedTasks > 0 ? "Attention" : completionRate === 100 ? "Ready" : "Running"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-semibold text-foreground">{completionRate}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-surface-soft">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#126da6_0%,#1f9d68_100%)] transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Todo", value: todoTasks, className: "text-warning" },
                { label: "In Progress", value: inProgressTasks, className: "text-accent" },
                { label: "Blocked", value: blockedTasks, className: "text-danger" },
                { label: "Remaining", value: remainingTasks, className: "text-foreground" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className={`mt-1 text-xl font-semibold ${item.className}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-white">
            <CardTitle>Recent Task Activity</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest node movement by assignment or completion time.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface-soft/70 px-3 py-5 text-center text-sm text-muted-foreground">
                No task activity available yet.
              </div>
            ) : (
              recentTasks.map((task) => (
                <div
                  key={task._id}
                  className={`rounded-lg border bg-white p-3 ${getTaskNodeFrameClasses(getTaskNodeState(task))}`}
                >
                  <p className="text-sm font-semibold text-foreground">{task.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={getTaskBadgeVariant(task.status)}>{formatStatus(task.status)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(task.completedAt ?? task.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {resolveUserLabel(task.assignedDeveloperId)}
                  </p>
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


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

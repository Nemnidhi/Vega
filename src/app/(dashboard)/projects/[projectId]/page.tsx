import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { permissionRules } from "@/lib/auth/permissions";
import { getProjectByIdForActor } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

type Params = Promise<{ projectId: string }>;

type ProjectDetail = {
  _id: string;
  title: string;
  description?: string;
  status: string;
  clientId?: { legalName?: string; primaryContactName?: string; primaryContactEmail?: string } | null;
  projectManagerId?: { fullName?: string; email?: string } | null;
  team: Array<{ userId?: { fullName?: string; email?: string; role?: string } | null; role?: string }>;
  startDate?: string | null;
  targetEndDate?: string | null;
  taskSummary: { totalTasks: number; completedTasks: number; blockedTasks: number };
  rootTasks: Array<{
    _id: string;
    title: string;
    status: string;
    priority: string;
    code?: string;
    dueAt?: string | null;
    progressPercent?: number;
    assignedToUserId?: { fullName?: string } | null;
  }>;
};

// See projects/page.tsx's comment - this is the same intentional replacement of
// ProjectAssignmentBoard (built against the deleted embedded-tasks shape). Root tasks link out to
// /tasks/[id], the actual task workspace, rather than reimplementing task management here.
export default async function ProjectDetailPage({ params }: { params: Params }) {
  const { projectId } = await params;
  const session = await requireRoleAccess(permissionRules.accessProjectAssignments, {
    redirectTo: "/dashboard",
  });

  const project = (await getProjectByIdForActor(projectId, {
    role: session.role,
    userId: session.userId,
  })) as ProjectDetail | null;

  if (!project) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <DashboardHeader
        title={project.title}
        subtitle={project.description || undefined}
        showLeadCta={false}
        action={{ label: "All projects", href: "/projects" }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-vega-text-muted">
            <div className="flex justify-between">
              <span>Status</span>
              <Badge variant="accent">{project.status.replaceAll("_", " ")}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Client</span>
              <span className="text-vega-text-secondary">{project.clientId?.legalName ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span>Project manager</span>
              <span className="text-vega-text-secondary">{project.projectManagerId?.fullName ?? "Unassigned"}</span>
            </div>
            <div className="flex justify-between">
              <span>Start</span>
              <span className="text-vega-text-secondary">
                {project.startDate ? new Date(project.startDate).toLocaleDateString("en-IN") : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Target end</span>
              <span className="text-vega-text-secondary">
                {project.targetEndDate ? new Date(project.targetEndDate).toLocaleDateString("en-IN") : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
          </CardHeader>
          <CardContent>
            {project.team.length === 0 ? (
              <p className="text-xs text-vega-text-muted">No team members added yet.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {project.team.map((member, index) => (
                  <li key={index} className="flex justify-between">
                    <span className="text-vega-text-secondary">{member.userId?.fullName ?? "—"}</span>
                    <span className="text-vega-text-muted">{member.role || member.userId?.role || ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-vega-text-muted">
            <div className="flex justify-between">
              <span>Completed</span>
              <span className="text-vega-text-secondary">
                {project.taskSummary.completedTasks}/{project.taskSummary.totalTasks}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Blocked</span>
              <span className="text-vega-text-secondary">{project.taskSummary.blockedTasks}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Root tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {project.rootTasks.length === 0 ? (
            <p className="text-xs text-vega-text-muted">No tasks assigned to this project yet.</p>
          ) : (
            <ul className="divide-y divide-vega-border-soft">
              {project.rootTasks.map((task) => (
                <li key={task._id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                  <Link href={`/tasks/${task._id}`} className="min-w-0 flex-1 truncate text-vega-text hover:text-vega-purple-border">
                    {task.code ? <span className="text-vega-text-muted">{task.code} · </span> : null}
                    {task.title}
                  </Link>
                  <span className="shrink-0 text-vega-text-muted">{task.assignedToUserId?.fullName ?? "Unassigned"}</span>
                  <Badge variant="neutral">{task.status.replaceAll("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { permissionRules } from "@/lib/auth/permissions";
import { getProjectsForActor } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

type ProjectListItem = {
  _id: string;
  title: string;
  status: string;
  clientId?: { legalName?: string } | null;
  projectManagerId?: { fullName?: string } | null;
  updatedAt?: string | null;
  taskSummary: { totalTasks: number; completedTasks: number; blockedTasks: number };
};

const statusVariant: Record<string, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  planned: "neutral",
  in_progress: "accent",
  on_hold: "warning",
  completed: "success",
  cancelled: "danger",
};

// Minimal, honest project list against the current thin-container Project model (no embedded
// tasks - see models/Project.ts). The old ProjectAssignmentBoard (drag-drop assignment, per-task
// alerts, history) was built entirely against the deleted embedded-tasks shape and can't be
// salvaged as-is; a real replacement is real project-command-center work, not a data-shape fix -
// this page intentionally shows only what the new model actually has until that's built.
export default async function ProjectsPage() {
  const session = await requireRoleAccess(permissionRules.accessProjectAssignments, {
    redirectTo: "/dashboard",
  });

  const projects = (await getProjectsForActor({
    role: session.role,
    userId: session.userId,
  })) as ProjectListItem[];

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Projects"
        subtitle="Delivery containers linking clients, scope, and the tasks under them. Task assignment happens on each task directly (see /tasks)."
        showLeadCta={false}
      />

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-vega-text-muted">
            No projects yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project._id} href={`/projects/${project._id}`}>
              <Card className="h-full transition-colors duration-150 hover:border-vega-purple-border">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-5 text-vega-text">{project.title}</h3>
                    <Badge variant={statusVariant[project.status] ?? "neutral"}>
                      {project.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <dl className="space-y-1 text-xs text-vega-text-muted">
                    <div className="flex justify-between">
                      <dt>Client</dt>
                      <dd className="text-vega-text-secondary">{project.clientId?.legalName ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Project manager</dt>
                      <dd className="text-vega-text-secondary">{project.projectManagerId?.fullName ?? "Unassigned"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Tasks</dt>
                      <dd className="text-vega-text-secondary">
                        {project.taskSummary.completedTasks}/{project.taskSummary.totalTasks} done
                        {project.taskSummary.blockedTasks > 0 ? ` · ${project.taskSummary.blockedTasks} blocked` : ""}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

import { DashboardHeader } from "@/components/dashboard/header";
import { ProjectAssignmentBoard } from "@/components/projects/project-assignment-board";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { getDevelopers, getProjectsForActor } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

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

export default async function ProjectsPage() {
  const session = await requireRoleAccess(["admin", "developer"]);

  const [projects, developers] = await Promise.all([
    getProjectsForActor({
      role: session.role,
      userId: session.userId,
    }, { includeHistory: false }),
    session.role === "admin" ? getDevelopers() : Promise.resolve([]),
  ]);

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Projects and Tasks"
        subtitle="Create projects and open any project card to view full details and task assignment."
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
      <ProjectAssignmentBoard
        initialProjects={projects as ProjectPageItem[]}
        developerOptions={developers as Array<{ _id: string; fullName: string; email: string }>}
        canManage={session.role === "admin"}
        currentUserId={session.userId}
        showProjectCards
        showInlineDetails={false}
      />
    </section>
  );
}

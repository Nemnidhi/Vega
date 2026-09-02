import { DashboardHeader } from "@/components/dashboard/header";
import { TasksView } from "@/components/tasks/tasks-view";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { getAssignableUsers, getKpisForUser, getTasksWorkspace } from "@/lib/tasks/queries";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await requireRoleAccess([
    "admin",
    "partner",
    "sales",
    "digital_marketing",
    "project_manager",
    "developer",
  ]);

  const [tasks, kpis, assignableUsers] = await Promise.all([
    getTasksWorkspace(session.userId, session.role),
    getKpisForUser(session.userId, session.role),
    getAssignableUsers(session.role),
  ]);

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Tasks"
        subtitle="Plan, assign and track execution across Vega."
        showLeadCta={false}
      />
      <TasksView
        currentUserId={session.userId}
        currentUserRole={session.role}
        initialTasks={tasks}
        initialKpis={kpis}
        assignableUsers={assignableUsers}
      />
    </section>
  );
}

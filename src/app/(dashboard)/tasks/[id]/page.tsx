import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { TaskDetailTabs } from "@/components/tasks/task-detail-tabs";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { getAssignableUsers, getTaskDetailForUser } from "@/lib/tasks/queries";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function TaskDetailPage({ params }: { params: Params }) {
  const session = await requireRoleAccess([
    "admin",
    "partner",
    "sales",
    "digital_marketing",
    "project_manager",
    "developer",
  ]);
  const { id } = await params;

  const [detail, assignableUsers] = await Promise.all([
    getTaskDetailForUser(id, session.userId, session.role),
    getAssignableUsers(session.role),
  ]);

  if (!detail) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <DashboardHeader
        title={detail.task.title}
        subtitle="Task details, subtasks, files, comments, and activity."
        showLeadCta={false}
        action={{ label: "Back To Tasks", href: "/tasks" }}
      />
      <TaskDetailTabs
        task={detail.task}
        initialSubtasks={detail.subtasks}
        assignableUsers={assignableUsers}
        currentUserId={session.userId}
        currentUserRole={session.role}
      />
    </section>
  );
}

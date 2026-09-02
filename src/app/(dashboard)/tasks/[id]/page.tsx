import { notFound } from "next/navigation";
import { TaskWorkspaceHeader } from "@/components/tasks/task-workspace-header";
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
    <section className="space-y-4">
      <TaskWorkspaceHeader
        title={detail.task.title}
        code={detail.task.code}
        status={detail.task.status}
        priority={detail.task.priority}
        assignee={detail.task.assignedToUserId}
        dueAt={detail.task.dueAt}
        projectTitle={
          detail.task.projectId && typeof detail.task.projectId === "object"
            ? (detail.task.projectId as { title?: string }).title
            : null
        }
        progressPercent={detail.task.progressPercent}
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

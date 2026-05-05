"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type UserRef = {
  _id: string;
  fullName: string;
  email: string;
  role?: string;
  status?: string;
};

type TaskItem = {
  _id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  assignedDeveloperId?: UserRef | string | null;
  completedByDeveloperId?: UserRef | string | null;
  completedAt?: string | null;
  completionAlertPending?: boolean;
  createdAt?: string | null;
};

type ProjectStatus = "planned" | "in_progress" | "on_hold" | "completed";

type ProjectItem = {
  _id: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  assignedDeveloperId?: UserRef | string | null;
  tasks: TaskItem[];
  updatedAt?: string | null;
};

type DeveloperOption = {
  _id: string;
  fullName: string;
  email: string;
};

interface ProjectAssignmentBoardProps {
  initialProjects: ProjectItem[];
  developerOptions: DeveloperOption[];
  canManage: boolean;
  currentUserId?: string;
}

const initialProjectForm = {
  title: "",
  description: "",
  assignedDeveloperId: "",
};

const initialTaskForm = {
  title: "",
  description: "",
  assignedDeveloperId: "",
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

function getUserId(value: UserRef | string | null | undefined) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return value._id;
}

function getPendingAlertKeys(projects: ProjectItem[]) {
  const keys = new Set<string>();
  for (const project of projects) {
    for (const task of project.tasks) {
      if (task.completionAlertPending) {
        keys.add(`${project._id}:${task._id}`);
      }
    }
  }
  return keys;
}

export function ProjectAssignmentBoard({
  initialProjects,
  developerOptions,
  canManage,
  currentUserId,
}: ProjectAssignmentBoardProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [projectForm, setProjectForm] = useState({
    ...initialProjectForm,
    assignedDeveloperId: developerOptions[0]?._id ?? "",
  });
  const [taskForms, setTaskForms] = useState<Record<string, typeof initialTaskForm>>({});
  const [projectLoading, setProjectLoading] = useState(false);
  const [taskLoadingMap, setTaskLoadingMap] = useState<Record<string, boolean>>({});
  const [statusLoadingMap, setStatusLoadingMap] = useState<Record<string, boolean>>({});
  const [completeTaskLoadingMap, setCompleteTaskLoadingMap] = useState<Record<string, boolean>>(
    {},
  );
  const [alertLoadingMap, setAlertLoadingMap] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const pendingAlertKeysRef = useRef<Set<string>>(new Set());

  const defaultDeveloperId = useMemo(
    () => developerOptions[0]?._id ?? "",
    [developerOptions],
  );

  const runningProjects = useMemo(
    () => projects.filter((project) => project.status !== "completed"),
    [projects],
  );
  const completedProjects = useMemo(
    () => projects.filter((project) => project.status === "completed"),
    [projects],
  );
  const pendingCompletionAlerts = useMemo(
    () =>
      projects.flatMap((project) =>
        project.tasks
          .filter((task) => task.completionAlertPending)
          .map((task) => ({ project, task })),
      ),
    [projects],
  );

  useEffect(() => {
    pendingAlertKeysRef.current = getPendingAlertKeys(projects);
  }, [projects]);

  useEffect(() => {
    let disposed = false;

    async function refreshProjectsFromServer() {
      try {
        const response = await fetch("/api/projects", {
          method: "GET",
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok || !data?.success || disposed) {
          return;
        }

        const nextProjects = data.data as ProjectItem[];
        const nextAlertKeys = getPendingAlertKeys(nextProjects);
        const previousAlertKeys = pendingAlertKeysRef.current;

        if (canManage) {
          const newlyAddedKeys = [...nextAlertKeys].filter(
            (key) => !previousAlertKeys.has(key),
          );
          if (newlyAddedKeys.length > 0) {
            const [projectId, taskId] = newlyAddedKeys[0]!.split(":");
            const firstProject = nextProjects.find((project) => project._id === projectId);
            const firstTask = firstProject?.tasks.find((task) => task._id === taskId);
            const firstTaskTitle = firstTask?.title ?? "Assigned task";

            setPopupMessage(
              `${firstTaskTitle} marked completed by developer. Admin alert received.`,
            );
          }
        }

        pendingAlertKeysRef.current = nextAlertKeys;
        setProjects(nextProjects);
      } catch {
        // ignore polling errors and retry on next interval
      }
    }

    refreshProjectsFromServer();
    const interval = setInterval(refreshProjectsFromServer, 10000);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [canManage]);

  useEffect(() => {
    if (!popupMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setPopupMessage("");
    }, 7000);

    return () => clearTimeout(timeout);
  }, [popupMessage]);

  function resolveUserLabel(value: UserRef | string | null | undefined) {
    if (!value) {
      return "Unassigned";
    }
    if (typeof value === "string") {
      return value;
    }
    return value.fullName ? `${value.fullName} (${value.email})` : value.email;
  }

  function readTaskForm(projectId: string) {
    return taskForms[projectId] ?? {
      ...initialTaskForm,
      assignedDeveloperId: defaultDeveloperId,
    };
  }

  function updateTaskForm(projectId: string, patch: Partial<typeof initialTaskForm>) {
    setTaskForms((prev) => ({
      ...prev,
      [projectId]: {
        ...readTaskForm(projectId),
        ...patch,
      },
    }));
  }

  function syncProject(updatedProject: ProjectItem) {
    setProjects((prev) =>
      prev.map((project) => (project._id === updatedProject._id ? updatedProject : project)),
    );
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    setProjectLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectForm),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to create project assignment");
      }

      setProjects((prev) => [data.data as ProjectItem, ...prev]);
      setProjectForm({
        ...initialProjectForm,
        assignedDeveloperId: defaultDeveloperId,
      });
      setMessage("Project created successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create project");
    } finally {
      setProjectLoading(false);
    }
  }

  async function createTask(projectId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    const form = readTaskForm(projectId);
    setTaskLoadingMap((prev) => ({ ...prev, [projectId]: true }));
    setMessage("");

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to assign task");
      }

      const updatedProject = data.data as ProjectItem;
      syncProject(updatedProject);
      setTaskForms((prev) => ({
        ...prev,
        [projectId]: {
          ...initialTaskForm,
          assignedDeveloperId: defaultDeveloperId,
        },
      }));
      setMessage("Task assigned successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to assign task");
    } finally {
      setTaskLoadingMap((prev) => ({ ...prev, [projectId]: false }));
    }
  }

  async function updateProjectStatus(
    projectId: string,
    status: ProjectStatus,
    successMessage: string,
  ) {
    if (!canManage) return;

    setStatusLoadingMap((prev) => ({ ...prev, [projectId]: true }));
    setMessage("");
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to update project status");
      }

      const updatedProject = data.data as ProjectItem;
      syncProject(updatedProject);
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update project");
    } finally {
      setStatusLoadingMap((prev) => ({ ...prev, [projectId]: false }));
    }
  }

  async function markTaskCompleted(projectId: string, taskId: string) {
    const key = `${projectId}:${taskId}`;
    setCompleteTaskLoadingMap((prev) => ({ ...prev, [key]: true }));
    setMessage("");

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to mark task as completed");
      }

      const updatedProject = data.data as ProjectItem;
      syncProject(updatedProject);
      setMessage("Task marked completed. Admin has been alerted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to mark task completed");
    } finally {
      setCompleteTaskLoadingMap((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function acknowledgeCompletionAlert(projectId: string, taskId: string) {
    const key = `${projectId}:${taskId}`;
    setAlertLoadingMap((prev) => ({ ...prev, [key]: true }));
    setMessage("");

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}/alert`, {
        method: "PATCH",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to acknowledge completion alert");
      }

      const updatedProject = data.data as ProjectItem;
      syncProject(updatedProject);
      setMessage("Alert acknowledged.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to acknowledge alert");
    } finally {
      setAlertLoadingMap((prev) => ({ ...prev, [key]: false }));
    }
  }

  function renderTaskTable(project: ProjectItem) {
    const showDeveloperActionColumn = !canManage;

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-2 py-2">Task</th>
              <th className="px-2 py-2">Assigned To</th>
              <th className="px-2 py-2">Status</th>
              {showDeveloperActionColumn ? <th className="px-2 py-2">Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {project.tasks.map((task) => {
              const assignedToCurrentDeveloper =
                currentUserId && getUserId(task.assignedDeveloperId) === currentUserId;
              const canMarkCompleted =
                Boolean(assignedToCurrentDeveloper) && task.status !== "done";
              const loadingKey = `${project._id}:${task._id}`;
              const isMarkingCompleted = completeTaskLoadingMap[loadingKey] ?? false;

              return (
                <tr key={task._id} className="border-b border-border/70">
                  <td className="px-2 py-3">
                    <p className="font-semibold text-foreground">{task.title}</p>
                    {task.description ? (
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                    ) : null}
                    {task.status === "done" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Completed at: {formatDate(task.completedAt)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-2 py-3">{resolveUserLabel(task.assignedDeveloperId)}</td>
                  <td className="px-2 py-3">
                    {formatStatus(task.status)}
                    {task.completionAlertPending ? (
                      <p className="mt-1 text-xs font-medium text-danger">
                        Completion alert pending
                      </p>
                    ) : null}
                  </td>
                  {showDeveloperActionColumn ? (
                    <td className="px-2 py-3">
                      {canMarkCompleted ? (
                        <Button
                          size="sm"
                          onClick={() => markTaskCompleted(project._id, task._id)}
                          disabled={isMarkingCompleted}
                        >
                          {isMarkingCompleted ? "Updating..." : "Mark Completed"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {task.status === "done" ? "Completed" : "No action"}
                        </span>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {project.tasks.length === 0 ? (
              <tr>
                <td
                  colSpan={showDeveloperActionColumn ? 4 : 3}
                  className="px-2 py-5 text-center text-muted-foreground"
                >
                  No tasks assigned yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  }

  function renderRunningProjectCard(project: ProjectItem) {
    const taskForm = readTaskForm(project._id);
    const taskLoading = taskLoadingMap[project._id] ?? false;
    const statusLoading = statusLoadingMap[project._id] ?? false;

    return (
      <Card key={project._id}>
        <CardHeader>
          <CardTitle>{project.title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Assigned to: {resolveUserLabel(project.assignedDeveloperId)} | Status:{" "}
            {formatStatus(project.status)}
          </p>
          {project.description ? (
            <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-5">
          {canManage ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={statusLoading}
                onClick={() =>
                  updateProjectStatus(project._id, "completed", "Project moved to completed history.")
                }
              >
                {statusLoading ? "Updating..." : "Mark Completed"}
              </Button>
            </div>
          ) : null}

          {canManage ? (
            <form className="grid gap-3" onSubmit={(event) => createTask(project._id, event)}>
              <Input
                placeholder="Task title"
                value={taskForm.title}
                onChange={(event) =>
                  updateTaskForm(project._id, { title: event.target.value })
                }
                required
              />
              <Textarea
                placeholder="Task notes (optional)"
                value={taskForm.description}
                onChange={(event) =>
                  updateTaskForm(project._id, { description: event.target.value })
                }
              />
              <select
                className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                value={taskForm.assignedDeveloperId}
                onChange={(event) =>
                  updateTaskForm(project._id, {
                    assignedDeveloperId: event.target.value,
                  })
                }
                required
              >
                <option value="" disabled>
                  Select developer
                </option>
                {developerOptions.map((developer) => (
                  <option key={developer._id} value={developer._id}>
                    {developer.fullName} ({developer.email})
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={taskLoading || developerOptions.length === 0}>
                  {taskLoading ? "Assigning..." : "Assign Task"}
                </Button>
              </div>
            </form>
          ) : null}

          {renderTaskTable(project)}
        </CardContent>
      </Card>
    );
  }

  function renderCompletedProjectCard(project: ProjectItem) {
    const statusLoading = statusLoadingMap[project._id] ?? false;

    return (
      <Card key={project._id}>
        <CardHeader>
          <CardTitle>{project.title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Assigned to: {resolveUserLabel(project.assignedDeveloperId)} | Completed on:{" "}
            {formatDate(project.updatedAt)}
          </p>
          {project.description ? (
            <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-5">
          {canManage ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={statusLoading}
                onClick={() =>
                  updateProjectStatus(project._id, "in_progress", "Project moved back to running.")
                }
              >
                {statusLoading ? "Updating..." : "Move To Running"}
              </Button>
            </div>
          ) : null}
          {renderTaskTable(project)}
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      {canManage && popupMessage ? (
        <div className="fixed right-4 top-4 z-50 w-full max-w-sm rounded-2xl border border-danger/30 bg-white p-4 shadow-[0_20px_44px_rgba(21,28,45,0.2)]">
          <p className="text-sm font-semibold text-foreground">Task Completion Alert</p>
          <p className="mt-1 text-sm text-muted-foreground">{popupMessage}</p>
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={() => setPopupMessage("")}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={createProject}>
              <Input
                placeholder="Project title"
                value={projectForm.title}
                onChange={(event) =>
                  setProjectForm((prev) => ({ ...prev, title: event.target.value }))
                }
                required
              />
              <Textarea
                placeholder="Project summary (optional)"
                value={projectForm.description}
                onChange={(event) =>
                  setProjectForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
              <select
                className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                value={projectForm.assignedDeveloperId}
                onChange={(event) =>
                  setProjectForm((prev) => ({
                    ...prev,
                    assignedDeveloperId: event.target.value,
                  }))
                }
                required
              >
                <option value="" disabled>
                  Select developer
                </option>
                {developerOptions.map((developer) => (
                  <option key={developer._id} value={developer._id}>
                    {developer.fullName} ({developer.email})
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={projectLoading || developerOptions.length === 0}>
                  {projectLoading ? "Creating..." : "Create Project"}
                </Button>
                {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Assigned Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This view shows projects and tasks assigned to you by admin.
            </p>
            {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
          </CardContent>
        </Card>
      )}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Task Completion Alerts ({pendingCompletionAlerts.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingCompletionAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No new completion alerts from developers.
              </p>
            ) : (
              pendingCompletionAlerts.map(({ project, task }) => {
                const key = `${project._id}:${task._id}`;
                const isAcknowledging = alertLoadingMap[key] ?? false;

                return (
                  <div
                    key={key}
                    className="rounded-xl border border-border/70 bg-white/80 p-3"
                  >
                    <p className="font-semibold text-foreground">
                      {task.title} | {project.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Completed by: {resolveUserLabel(task.completedByDeveloperId)} |{" "}
                      {formatDate(task.completedAt)}
                    </p>
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isAcknowledging}
                        onClick={() => acknowledgeCompletionAlert(project._id, task._id)}
                      >
                        {isAcknowledging ? "Acknowledging..." : "Acknowledge Alert"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Running Projects ({runningProjects.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {runningProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No running projects right now.</p>
              ) : (
                runningProjects.map((project) => renderRunningProjectCard(project))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Completed Projects History ({completedProjects.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {completedProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No completed projects in history yet.
                </p>
              ) : (
                completedProjects.map((project) => renderCompletedProjectCard(project))
              )}
            </CardContent>
          </Card>
        </>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No projects assigned to you yet.
          </CardContent>
        </Card>
      ) : (
        projects.map((project) =>
          project.status === "completed"
            ? renderCompletedProjectCard(project)
            : renderRunningProjectCard(project),
        )
      )}
    </section>
  );
}

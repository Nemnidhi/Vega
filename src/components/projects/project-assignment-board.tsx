"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

type ProjectSortOption =
  | "recent"
  | "oldest"
  | "tasks_desc"
  | "tasks_asc"
  | "completion_desc";

type ProjectHealthFilter = "all" | "with_blocked" | "with_pending_alerts";

interface ProjectAssignmentBoardProps {
  initialProjects: ProjectItem[];
  developerOptions: DeveloperOption[];
  canManage: boolean;
  currentUserId?: string;
  showProjectCards?: boolean;
  showInlineDetails?: boolean;
  initialSelectedProjectId?: string | null;
  projectDetailsPageBasePath?: string;
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

function getProjectTaskSummary(project: ProjectItem) {
  const totalTasks = project.tasks.length;
  const completedTasks = project.tasks.filter((task) => task.status === "done").length;
  const blockedTasks = project.tasks.filter((task) => task.status === "blocked").length;
  const pendingAlerts = project.tasks.filter((task) => task.completionAlertPending).length;
  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    totalTasks,
    completedTasks,
    blockedTasks,
    pendingAlerts,
    completionRate,
  };
}

export function ProjectAssignmentBoard({
  initialProjects,
  developerOptions,
  canManage,
  currentUserId,
  showProjectCards = true,
  showInlineDetails = false,
  initialSelectedProjectId = null,
  projectDetailsPageBasePath = "/projects",
}: ProjectAssignmentBoardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
  const [message, setMessage] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialSelectedProjectId,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [healthFilter, setHealthFilter] = useState<ProjectHealthFilter>("all");
  const [sortBy, setSortBy] = useState<ProjectSortOption>("recent");
  const pendingAlertKeysRef = useRef<Set<string>>(new Set());
  const isCreateProjectRequested =
    canManage && searchParams.get("createProject") === "1";
  const isCreateProjectModalOpen =
    showCreateProjectForm || isCreateProjectRequested;

  function clearCreateProjectModalQuery() {
    if (!isCreateProjectRequested) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("createProject");
    const nextUrl = nextParams.size > 0 ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }

  function closeCreateProjectModal() {
    setShowCreateProjectForm(false);
    clearCreateProjectModalQuery();
  }

  const defaultDeveloperId = useMemo(
    () => developerOptions[0]?._id ?? "",
    [developerOptions],
  );

  const orderedProjects = useMemo(
    () =>
      [...projects].sort(
        (a, b) =>
          new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
      ),
    [projects],
  );
  const selectedProject = useMemo(() => {
    if (!showInlineDetails) {
      return null;
    }
    if (!selectedProjectId) {
      return null;
    }
    return orderedProjects.find((project) => project._id === selectedProjectId) ?? null;
  }, [orderedProjects, selectedProjectId, showInlineDetails]);
  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const results = orderedProjects.filter((project) => {
      if (statusFilter !== "all" && project.status !== statusFilter) {
        return false;
      }

      if (
        healthFilter === "with_blocked" &&
        !project.tasks.some((task) => task.status === "blocked")
      ) {
        return false;
      }

      if (
        healthFilter === "with_pending_alerts" &&
        !project.tasks.some((task) => task.completionAlertPending)
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const description = project.description?.toLowerCase() ?? "";
      const assignedTo = resolveUserLabel(project.assignedDeveloperId).toLowerCase();
      const taskMatch = project.tasks.some((task) => {
        const taskTitle = task.title.toLowerCase();
        const taskDescription = task.description?.toLowerCase() ?? "";
        return (
          taskTitle.includes(normalizedSearch) ||
          taskDescription.includes(normalizedSearch)
        );
      });

      return (
        project.title.toLowerCase().includes(normalizedSearch) ||
        description.includes(normalizedSearch) ||
        assignedTo.includes(normalizedSearch) ||
        taskMatch
      );
    });

    return [...results].sort((a, b) => {
      const aSummary = getProjectTaskSummary(a);
      const bSummary = getProjectTaskSummary(b);
      const aUpdated = new Date(a.updatedAt ?? 0).getTime();
      const bUpdated = new Date(b.updatedAt ?? 0).getTime();

      if (sortBy === "oldest") {
        return aUpdated - bUpdated;
      }
      if (sortBy === "tasks_desc") {
        return bSummary.totalTasks - aSummary.totalTasks;
      }
      if (sortBy === "tasks_asc") {
        return aSummary.totalTasks - bSummary.totalTasks;
      }
      if (sortBy === "completion_desc") {
        return bSummary.completionRate - aSummary.completionRate;
      }
      return bUpdated - aUpdated;
    });
  }, [healthFilter, orderedProjects, searchTerm, sortBy, statusFilter]);
  const filteredRunningCount = useMemo(
    () => filteredProjects.filter((project) => project.status !== "completed").length,
    [filteredProjects],
  );
  const filteredCompletedCount = useMemo(
    () => filteredProjects.filter((project) => project.status === "completed").length,
    [filteredProjects],
  );
  const filteredTaskInsights = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;
    let blockedTasks = 0;
    let pendingAlerts = 0;

    for (const project of filteredProjects) {
      const summary = getProjectTaskSummary(project);
      totalTasks += summary.totalTasks;
      completedTasks += summary.completedTasks;
      blockedTasks += summary.blockedTasks;
      pendingAlerts += summary.pendingAlerts;
    }

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      completedTasks,
      blockedTasks,
      pendingAlerts,
      completionRate,
    };
  }, [filteredProjects]);
  const projectsNeedingAttention = useMemo(
    () =>
      filteredProjects.filter((project) => {
        const summary = getProjectTaskSummary(project);
        return summary.blockedTasks > 0 || summary.pendingAlerts > 0;
      }),
    [filteredProjects],
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

  useEffect(() => {
    if (!isCreateProjectModalOpen) {
      return;
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !projectLoading) {
        setShowCreateProjectForm(false);

        if (isCreateProjectRequested) {
          const nextParams = new URLSearchParams(searchParams.toString());
          nextParams.delete("createProject");
          const nextUrl = nextParams.size > 0 ? `${pathname}?${nextParams.toString()}` : pathname;
          router.replace(nextUrl, { scroll: false });
        }
      }
    }

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [
    isCreateProjectModalOpen,
    isCreateProjectRequested,
    pathname,
    projectLoading,
    router,
    searchParams,
  ]);

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

      const createdProject = data.data as ProjectItem;
      setProjects((prev) => [createdProject, ...prev]);
      setSelectedProjectId(createdProject._id);
      setProjectForm({
        ...initialProjectForm,
        assignedDeveloperId: defaultDeveloperId,
      });
      closeCreateProjectModal();
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

  function renderProjectSelectorCard(project: ProjectItem) {
    const isSelected = selectedProjectId === project._id;
    const detailsHref = `${projectDetailsPageBasePath}/${project._id}`;
    const summary = getProjectTaskSummary(project);
    const statusToneClass =
      project.status === "completed"
        ? "border-[#b8d7c3] bg-[#edf7f0] text-[#2f6a42]"
        : project.status === "in_progress"
          ? "border-[#bac8d5] bg-[#ecf2f7] text-[#274d6f]"
          : project.status === "on_hold"
            ? "border-[#e2b3ae] bg-[#faecea] text-[#a43c35]"
            : "border-[#dec39d] bg-[#f8f1e4] text-[#8a5a1f]";

    if (!showInlineDetails) {
      return (
        <Link key={project._id} href={detailsHref} className="block">
          <Card className="transition-colors hover:border-foreground/30 hover:bg-white">
            <CardHeader className="space-y-2 pb-1">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base md:text-base">{project.title}</CardTitle>
                <span
                  className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusToneClass}`}
                >
                  {formatStatus(project.status)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0 text-xs text-muted-foreground">
              <p>Assigned to: {resolveUserLabel(project.assignedDeveloperId)}</p>
              <p>
                Tasks: {summary.totalTasks} | Done: {summary.completedTasks} | Blocked:{" "}
                {summary.blockedTasks}
              </p>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>Progress</span>
                  <span className="font-semibold text-foreground">{summary.completionRate}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-soft">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${summary.completionRate}%` }}
                  />
                </div>
              </div>
              <p>Updated: {formatDate(project.updatedAt)}</p>
              <p className="pt-1 text-[11px] font-medium text-foreground/80">
                Open project details
              </p>
            </CardContent>
          </Card>
        </Link>
      );
    }

    return (
      <button
        key={project._id}
        type="button"
        className="w-full cursor-pointer text-left"
        onClick={() => setSelectedProjectId(project._id)}
        aria-pressed={isSelected}
      >
        <Card
          className={
            isSelected
              ? "border-foreground/40 bg-white shadow-md ring-1 ring-foreground/20"
              : "transition-colors hover:border-foreground/30 hover:bg-white"
          }
        >
          <CardHeader className="space-y-2">
            <CardTitle className="text-base md:text-base">{project.title}</CardTitle>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Status: {formatStatus(project.status)}
            </p>
          </CardHeader>
          <CardContent className="space-y-1 pt-0 text-xs text-muted-foreground">
            <p>Assigned to: {resolveUserLabel(project.assignedDeveloperId)}</p>
            <p>Tasks: {project.tasks.length}</p>
            <p>Updated: {formatDate(project.updatedAt)}</p>
            <p className="pt-1 text-[11px] font-medium text-foreground/80">
              Click to view details
            </p>
          </CardContent>
        </Card>
      </button>
    );
  }

  function renderProjectDetailsCard(project: ProjectItem) {
    const taskForm = readTaskForm(project._id);
    const taskLoading = taskLoadingMap[project._id] ?? false;
    const statusLoading = statusLoadingMap[project._id] ?? false;
    const isCompletedProject = project.status === "completed";

    return (
      <Card key={`details-${project._id}`}>
        <CardHeader>
          <CardTitle>{project.title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Assigned to: {resolveUserLabel(project.assignedDeveloperId)} | Status:{" "}
            {formatStatus(project.status)} | Last updated: {formatDate(project.updatedAt)}
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
                onClick={() => {
                  if (isCompletedProject) {
                    updateProjectStatus(
                      project._id,
                      "in_progress",
                      "Project moved back to running.",
                    );
                    return;
                  }
                  updateProjectStatus(
                    project._id,
                    "completed",
                    "Project moved to completed history.",
                  );
                }}
              >
                {statusLoading
                  ? "Updating..."
                  : isCompletedProject
                    ? "Move To Running"
                    : "Mark Completed"}
              </Button>
            </div>
          ) : null}

          {canManage && !isCompletedProject ? (
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

          {canManage && isCompletedProject ? (
            <p className="text-sm text-muted-foreground">
              Move this project to running if you want to assign new tasks.
            </p>
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

      {canManage && isCreateProjectModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-foreground">Create New Project</h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={closeCreateProjectModal}
                disabled={projectLoading}
              >
                Close
              </Button>
            </div>

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
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeCreateProjectModal}
                  disabled={projectLoading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

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

      {showProjectCards ? (
        <Card>
          <CardHeader>
            <CardTitle>
              All Projects ({filteredProjects.length}
              {filteredProjects.length !== orderedProjects.length
                ? ` of ${orderedProjects.length}`
                : ""})
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Running: {filteredRunningCount} | Completed: {filteredCompletedCount}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-white p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  Task Completion
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {filteredTaskInsights.completionRate}%
                </p>
              </div>
              <div className="rounded-lg border border-border bg-white p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  Total Tasks
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {filteredTaskInsights.totalTasks}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-white p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  Blocked Tasks
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {filteredTaskInsights.blockedTasks}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-white p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  Pending Alerts
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {filteredTaskInsights.pendingAlerts}
                </p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
              <Input
                placeholder="Search by project, developer, task..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <select
                className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | ProjectStatus)
                }
              >
                <option value="all">All statuses</option>
                <option value="planned">Planned</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
              <select
                className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                value={healthFilter}
                onChange={(event) =>
                  setHealthFilter(event.target.value as ProjectHealthFilter)
                }
              >
                <option value="all">All health states</option>
                <option value="with_blocked">With blocked tasks</option>
                <option value="with_pending_alerts">With pending alerts</option>
              </select>
              <select
                className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as ProjectSortOption)
                }
              >
                <option value="recent">Sort: Recently updated</option>
                <option value="oldest">Sort: Oldest updated</option>
                <option value="tasks_desc">Sort: Most tasks</option>
                <option value="tasks_asc">Sort: Least tasks</option>
                <option value="completion_desc">Sort: Highest completion</option>
              </select>
            </div>

            {projectsNeedingAttention.length > 0 ? (
              <div className="rounded-xl border border-border/70 bg-white p-3">
                <p className="text-sm font-semibold text-foreground">Needs Attention</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {projectsNeedingAttention.slice(0, 4).map((project) => {
                    const summary = getProjectTaskSummary(project);
                    return (
                      <Link
                        key={project._id}
                        href={`${projectDetailsPageBasePath}/${project._id}`}
                        className="rounded-md border border-border bg-surface-soft px-2.5 py-1 hover:bg-white"
                      >
                        {project.title} | blocked: {summary.blockedTasks}, alerts: {summary.pendingAlerts}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {filteredProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {orderedProjects.length === 0
                  ? canManage
                    ? "No projects created yet."
                    : "No projects assigned to you yet."
                  : "No projects match the current filters."}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project) => renderProjectSelectorCard(project))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {showInlineDetails ? (
        selectedProject ? (
          renderProjectDetailsCard(selectedProject)
        ) : (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Select a project card to view full details and tasks.
            </CardContent>
          </Card>
        )
      ) : null}
    </section>
  );
}

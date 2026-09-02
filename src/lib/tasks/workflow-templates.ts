import mongoose, { Types, type ClientSession } from "mongoose";
import { TaskDependencyModel, TaskModel, TaskWorkflowTemplateModel } from "@/models";
import { assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { createDependency } from "@/lib/tasks/dependencies";
import { generateSubtaskCode, normalizeTaskCode, populateTaskRelations, type TaskActor } from "@/lib/tasks/subtasks";
import { serializeForJson } from "@/lib/utils/serialize";

type TemplateNode = {
  key: string;
  title: string;
  description?: string;
  stageKey?: string;
  status?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  workflowNodeType?: "SUBTASK" | "MILESTONE" | "APPROVAL" | "CONDITION" | "MERGE" | "WAIT" | "START" | "END";
  estimatedDurationDays?: number;
  estimatedEffortHours?: number | null;
  positionX?: number | null;
  positionY?: number | null;
  width?: number | null;
  order: number;
  tags?: string[];
  assignedToUserId?: string | null;
};

type TemplateStage = {
  key: string;
  name: string;
  color: string;
  collapsed: boolean;
  order: number;
};

type TemplateDependency = {
  predecessorKey: string;
  successorKey: string;
  dependencyType?: "FINISH_TO_START" | "START_TO_START" | "FINISH_TO_FINISH";
  lagDuration?: number | null;
  branchKey?: string;
  branchLabel?: string;
};

type TemplatePayload = {
  name: string;
  description?: string;
  category?: string;
  copyAssignees?: boolean;
  taskTitle: string;
  taskDescription?: string;
  taskPriority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  estimatedDurationDays?: number;
  stages: TemplateStage[];
  nodes: TemplateNode[];
  dependencies: TemplateDependency[];
};

type UpdateTemplatePayload = Partial<TemplatePayload> & {
  status?: "active" | "archived";
};

type ApplyPayload = {
  title?: string;
  description?: string;
  assignedToUserId?: string;
  startAt?: Date | null;
  dueAt?: Date | null;
  projectId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
  copyAssignees?: boolean;
};

export const MANAGE_TASK_TEMPLATE_ROLES = ["admin", "partner", "project_manager"] as const;

function assertCanManageTemplates(actor: TaskActor) {
  assertRoleAccess(actor.role, { oneOf: [...MANAGE_TASK_TEMPLATE_ROLES] });
}

function canAssignOthers(actor: TaskActor) {
  return (permissionRules.assignTasksToOthers as string[]).includes(actor.role);
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

async function runMaybeTransaction<T>(fn: (session?: ClientSession) => Promise<T>) {
  const session = await mongoose.startSession();
  try {
    let output: T | undefined;
    await session.withTransaction(async () => {
      output = await fn(session);
    });
    return output as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.toLowerCase().includes("transaction")) throw error;
    return fn(undefined);
  } finally {
    await session.endSession();
  }
}

function keyOf(value: string) {
  return normalizeTaskCode(value).slice(0, 80);
}

function makeStages(names: string[]) {
  const colors = ["accent", "warning", "success", "danger", "neutral"];
  return names.map((name, order) => ({
    key: keyOf(name),
    name,
    color: colors[order % colors.length],
    collapsed: false,
    order,
  }));
}

function makeNodes(names: string[], stages: TemplateStage[]) {
  return names.map((name, order) => {
    const stage = stages[Math.min(stages.length - 1, Math.floor((order / Math.max(1, names.length)) * stages.length))];
    return {
      key: keyOf(name),
      title: name,
      description: "",
      stageKey: stage?.key ?? "",
      priority: order === names.length - 1 ? "HIGH" : "MEDIUM",
      workflowNodeType: name.toLowerCase().includes("approval") ? "APPROVAL" : order === names.length - 1 ? "MILESTONE" : "SUBTASK",
      estimatedDurationDays: 2,
      estimatedEffortHours: null,
      positionX: (order % 4) * 320,
      positionY: Math.floor(order / 4) * 160,
      width: 280,
      order,
      tags: [],
    } satisfies TemplateNode;
  });
}

function linearDeps(nodes: TemplateNode[]) {
  return nodes.slice(1).map((node, index) => ({
    predecessorKey: nodes[index].key,
    successorKey: node.key,
    dependencyType: "FINISH_TO_START" as const,
  }));
}

function assertTemplateDependencyGraphValid(nodes: TemplateNode[], dependencies: TemplateDependency[]) {
  const nodeKeys = new Set(nodes.map((node) => node.key));
  const adjacency = new Map<string, string[]>();

  for (const dependency of dependencies) {
    if (dependency.predecessorKey === dependency.successorKey) {
      throw new Error("A template dependency cannot point to itself.");
    }
    if (!nodeKeys.has(dependency.predecessorKey) || !nodeKeys.has(dependency.successorKey)) {
      throw new Error("Template dependencies must reference existing template nodes.");
    }
    adjacency.set(dependency.predecessorKey, [
      ...(adjacency.get(dependency.predecessorKey) ?? []),
      dependency.successorKey,
    ]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(key: string) {
    if (visiting.has(key)) throw new Error("Circular template dependencies are not allowed.");
    if (visited.has(key)) return;
    visiting.add(key);
    for (const next of adjacency.get(key) ?? []) visit(next);
    visiting.delete(key);
    visited.add(key);
  }

  for (const key of nodeKeys) visit(key);
}

const DEFAULT_TEMPLATES: TemplatePayload[] = [
  ["Website Development", ["PLANNING", "DESIGN", "DEVELOPMENT", "TESTING", "APPROVAL", "DEPLOYMENT"], ["Requirement Gathering", "UI/UX", "Frontend", "Backend", "Integration", "QA", "Client Approval", "Deployment"]],
  ["CRM Development", ["PLANNING", "ARCHITECTURE", "DEVELOPMENT", "TESTING", "DEPLOYMENT"], ["Requirement Mapping", "Data Model", "Role Setup", "Lead Pipeline", "Dashboard", "QA", "Release"]],
  ["Mobile App Development", ["PLANNING", "DESIGN", "DEVELOPMENT", "TESTING", "RELEASE"], ["Scope", "Wireframes", "API Contract", "Mobile UI", "Backend Integration", "Device QA", "Store Release"]],
  ["Client Onboarding", ["INTAKE", "SETUP", "TRAINING", "HANDOVER"], ["Welcome Call", "Document Collection", "Account Setup", "Team Introduction", "Training", "Go Live"]],
  ["Employee Onboarding", ["PREJOINING", "SETUP", "TRAINING", "REVIEW"], ["Offer Confirmation", "Document Verification", "System Access", "Orientation", "Role Training", "First Week Review"]],
  ["Software Release", ["PREP", "QA", "APPROVAL", "DEPLOYMENT"], ["Release Scope", "Regression QA", "Security Check", "Approval", "Production Deploy", "Post Release Check"]],
  ["Bug Resolution", ["TRIAGE", "FIX", "VERIFY", "CLOSE"], ["Reproduce Bug", "Root Cause", "Fix", "Code Review", "QA Verification", "Close Bug"]],
  ["Marketing Campaign", ["PLANNING", "CREATIVE", "LAUNCH", "OPTIMIZE"], ["Campaign Brief", "Audience Setup", "Creative", "Landing Page", "Launch", "Performance Review"]],
].map(([name, stageNames, nodeNames]) => {
  const stages = makeStages(stageNames as string[]);
  const nodes = makeNodes(nodeNames as string[], stages);
  return {
    name: name as string,
    description: `${name} reusable workflow template.`,
    category: "Default",
    taskTitle: name as string,
    taskDescription: "",
    taskPriority: "MEDIUM",
    estimatedDurationDays: nodes.reduce((sum, node) => sum + (node.estimatedDurationDays ?? 1), 0),
    stages,
    nodes,
    dependencies: linearDeps(nodes),
  };
});

export async function ensureDefaultTaskWorkflowTemplates() {
  const count = await TaskWorkflowTemplateModel.countDocuments({ isSystem: true });
  if (count > 0) return;
  await TaskWorkflowTemplateModel.insertMany(
    DEFAULT_TEMPLATES.map((template) => ({
      ...template,
      status: "active",
      isSystem: true,
      copyAssignees: false,
      createdBy: null,
      updatedBy: null,
    })),
    { ordered: false },
  ).catch(() => undefined);
}

export async function listTaskWorkflowTemplates(includeArchived = false) {
  await ensureDefaultTaskWorkflowTemplates();
  const query = includeArchived ? {} : { status: "active" };
  const templates = await TaskWorkflowTemplateModel.find(query).sort({ isSystem: -1, name: 1 }).lean();
  return serializeForJson(templates);
}

export async function createTaskWorkflowTemplate(payload: TemplatePayload, actor: TaskActor) {
  assertCanManageTemplates(actor);
  assertTemplateDependencyGraphValid(payload.nodes, payload.dependencies);
  const template = await TaskWorkflowTemplateModel.create({
    ...payload,
    status: "active",
    isSystem: false,
    copyAssignees: payload.copyAssignees ?? false,
    createdBy: actor.userId,
    updatedBy: actor.userId,
  });
  return serializeForJson(template);
}

export async function updateTaskWorkflowTemplate(templateId: string, payload: UpdateTemplatePayload, actor: TaskActor) {
  assertCanManageTemplates(actor);
  const template = await TaskWorkflowTemplateModel.findById(templateId);
  if (!template) throw new Error("Template not found.");
  if (template.isSystem) throw new Error("System templates can be duplicated but not edited.");

  const nextNodes = (payload.nodes ?? template.nodes) as TemplateNode[];
  const nextDependencies = (payload.dependencies ?? template.dependencies) as TemplateDependency[];
  assertTemplateDependencyGraphValid(nextNodes, nextDependencies);

  if (payload.name !== undefined) template.name = payload.name;
  if (payload.description !== undefined) template.description = payload.description;
  if (payload.category !== undefined) template.category = payload.category;
  if (payload.copyAssignees !== undefined) template.copyAssignees = payload.copyAssignees;
  if (payload.taskTitle !== undefined) template.taskTitle = payload.taskTitle;
  if (payload.taskDescription !== undefined) template.taskDescription = payload.taskDescription;
  if (payload.taskPriority !== undefined) template.taskPriority = payload.taskPriority;
  if (payload.estimatedDurationDays !== undefined) template.estimatedDurationDays = payload.estimatedDurationDays;
  if (payload.stages !== undefined) template.stages = payload.stages as typeof template.stages;
  if (payload.nodes !== undefined) template.nodes = payload.nodes as typeof template.nodes;
  if (payload.dependencies !== undefined) template.dependencies = payload.dependencies as typeof template.dependencies;
  if (payload.status !== undefined) {
    template.status = payload.status;
    template.archivedAt = payload.status === "archived" ? new Date() : null;
  }
  template.updatedBy = new Types.ObjectId(actor.userId);
  await template.save();
  return serializeForJson(template);
}

export async function createTemplateFromTask(
  payload: { taskId: string; name: string; description?: string; category?: string; copyAssignees?: boolean },
  actor: TaskActor,
) {
  assertCanManageTemplates(actor);
  const [task, subtasks, dependencies] = await Promise.all([
    TaskModel.findById(payload.taskId).lean(),
    TaskModel.find({ parentTaskId: payload.taskId }).sort({ order: 1, createdAt: 1 }).lean(),
    TaskDependencyModel.find({ parentTaskId: payload.taskId }).lean(),
  ]);
  if (!task) throw new Error("Task not found.");

  const keyById = new Map<string, string>();
  const nodes = subtasks.map((subtask, order) => {
    const key = keyOf(String(subtask.code || subtask.title || subtask._id));
    keyById.set(String(subtask._id), key);
    return {
      key,
      title: subtask.title,
      description: subtask.description ?? "",
      stageKey: keyOf(subtask.workflowGroup || subtask.stage || ""),
      status: "NOT_STARTED",
      priority: subtask.priority ?? "MEDIUM",
      workflowNodeType: subtask.workflowNodeType ?? "SUBTASK",
      estimatedDurationDays: Math.max(1, Math.ceil(((subtask.estimatedEffortHours ?? 8) as number) / 8)),
      estimatedEffortHours: subtask.estimatedEffortHours ?? null,
      tags: subtask.tags ?? [],
      positionX: subtask.workflowPositionX ?? null,
      positionY: subtask.workflowPositionY ?? null,
      width: subtask.workflowWidth ?? null,
      order,
      assignedToUserId: payload.copyAssignees ? String(subtask.assignedToUserId) : null,
    };
  });

  const stageKeys = new Set(nodes.map((node) => node.stageKey).filter(Boolean));
  const stages = (task.workflowStages?.length ? task.workflowStages : [...stageKeys].map((key, order) => ({ key, name: key, color: "accent", collapsed: false, order })))
    .map((stage: TemplateStage, order: number) => ({ key: keyOf(stage.key || stage.name), name: stage.name, color: stage.color ?? "accent", collapsed: false, order }));

  return createTaskWorkflowTemplate(
    {
      name: payload.name,
      description: payload.description ?? task.description ?? "",
      category: payload.category ?? "From Task",
      copyAssignees: payload.copyAssignees ?? false,
      taskTitle: task.title,
      taskDescription: task.description ?? "",
      taskPriority: task.priority ?? "MEDIUM",
      estimatedDurationDays: nodes.reduce((sum, node) => sum + (node.estimatedDurationDays ?? 1), 0),
      stages,
      nodes,
      dependencies: dependencies
        .map((dependency) => ({
          predecessorKey: keyById.get(String(dependency.predecessorSubtaskId)) ?? "",
          successorKey: keyById.get(String(dependency.successorSubtaskId)) ?? "",
          dependencyType: dependency.dependencyType ?? "FINISH_TO_START",
          lagDuration: dependency.lagDuration ?? null,
          branchKey: dependency.branchKey ?? "",
          branchLabel: dependency.branchLabel ?? "",
        }))
        .filter((dependency) => dependency.predecessorKey && dependency.successorKey),
    },
    actor,
  );
}

export async function duplicateTaskWorkflowTemplate(templateId: string, actor: TaskActor, name?: string) {
  assertCanManageTemplates(actor);
  const template = await TaskWorkflowTemplateModel.findById(templateId).lean();
  if (!template) throw new Error("Template not found.");
  const duplicate = await TaskWorkflowTemplateModel.create({
    name: name ?? `${template.name} Copy`,
    description: template.description,
    status: "active",
    category: template.category,
    isSystem: false,
    copyAssignees: false,
    taskTitle: template.taskTitle,
    taskDescription: template.taskDescription,
    taskPriority: template.taskPriority,
    estimatedDurationDays: template.estimatedDurationDays,
    stages: template.stages,
    nodes: template.nodes.map((node: TemplateNode) => ({ ...node, assignedToUserId: null })),
    dependencies: template.dependencies,
    createdBy: actor.userId,
    updatedBy: actor.userId,
  });
  return serializeForJson(duplicate);
}

export async function archiveTaskWorkflowTemplate(templateId: string, actor: TaskActor) {
  assertCanManageTemplates(actor);
  const template = await TaskWorkflowTemplateModel.findById(templateId);
  if (!template) throw new Error("Template not found.");
  if (template.isSystem) throw new Error("System templates can be duplicated but not archived.");
  template.status = "archived";
  template.archivedAt = new Date();
  template.updatedBy = new Types.ObjectId(actor.userId);
  await template.save();
  return serializeForJson(template);
}

export async function applyTaskWorkflowTemplate(templateId: string, actor: TaskActor, payload: ApplyPayload) {
  await ensureDefaultTaskWorkflowTemplates();
  const template = await TaskWorkflowTemplateModel.findOne({ _id: templateId, status: "active" }).lean();
  if (!template) throw new Error("Template not found.");

  const assignedToUserId = payload.assignedToUserId ?? actor.userId;
  if (assignedToUserId !== actor.userId && !canAssignOthers(actor)) {
    assertRoleAccess(actor.role, { oneOf: permissionRules.assignTasksToOthers });
  }

  const baseStart = payload.startAt ? new Date(payload.startAt) : new Date();
  const parentId = await runMaybeTransaction(async (session) => {
    const [parent] = await TaskModel.create(
      [
        {
          title: payload.title ?? template.taskTitle,
          description: payload.description ?? template.taskDescription ?? "",
          status: "todo",
          assignedToUserId,
          createdBy: actor.userId,
          dueAt: payload.dueAt ?? (template.estimatedDurationDays ? addDays(baseStart, template.estimatedDurationDays) : null),
          projectId: payload.projectId ?? null,
          leadId: payload.leadId ?? null,
          clientId: payload.clientId ?? null,
          priority: template.taskPriority,
          progressPercent: 0,
          workflowTemplate: "custom",
          workflowStages: template.stages,
        },
      ],
      { session },
    );

    const idByKey = new Map<string, string>();
    let cursor = 0;
    for (const node of [...template.nodes].sort((first, second) => first.order - second.order)) {
      const duration = Math.max(0, node.estimatedDurationDays ?? 1);
      const nodeStart = addDays(baseStart, cursor);
      const nodeDue = duration > 0 ? addDays(nodeStart, duration - 1) : nodeStart;
      const stage = template.stages.find((item: TemplateStage) => item.key === node.stageKey);
      const assignee =
        payload.copyAssignees && template.copyAssignees && node.assignedToUserId
          ? String(node.assignedToUserId)
          : assignedToUserId;
      if (assignee !== actor.userId && !canAssignOthers(actor)) {
        assertRoleAccess(actor.role, { oneOf: permissionRules.assignTasksToOthers });
      }
      const [subtask] = await TaskModel.create(
        [
          {
            code: await generateSubtaskCode(String(parent._id), undefined, { session }),
            title: node.title,
            description: node.description ?? "",
            status: node.status ?? "NOT_STARTED",
            priority: node.priority ?? "MEDIUM",
            assignedToUserId: assignee,
            createdBy: actor.userId,
            parentTaskId: parent._id,
            rootTaskId: parent._id,
            projectId: payload.projectId ?? null,
            startAt: nodeStart,
            dueAt: nodeDue,
            estimatedEffortHours: node.estimatedEffortHours ?? null,
            progressPercent: 0,
            tags: node.tags ?? [],
            stage: stage?.name ?? "",
            order: node.order,
            workflowNodeType: node.workflowNodeType ?? "SUBTASK",
            workflowGroup: node.stageKey ?? "",
            workflowPositionX: node.positionX ?? null,
            workflowPositionY: node.positionY ?? null,
            workflowWidth: node.width ?? null,
            workflowTemplate: "custom",
          },
        ],
        { session },
      );
      idByKey.set(node.key, String(subtask._id));
      cursor += Math.max(1, duration);
    }

    for (const dependency of template.dependencies) {
      const predecessorSubtaskId = idByKey.get(dependency.predecessorKey);
      const successorSubtaskId = idByKey.get(dependency.successorKey);
      if (!predecessorSubtaskId || !successorSubtaskId) continue;
      await createDependency(
        {
          parentTaskId: String(parent._id),
          predecessorSubtaskId,
          successorSubtaskId,
          dependencyType: dependency.dependencyType,
          lagDuration: dependency.lagDuration,
          branchKey: dependency.branchKey,
          branchLabel: dependency.branchLabel,
        },
        actor,
        { session },
      );
    }

    return String(parent._id);
  });

  const hydrated = await populateTaskRelations(TaskModel.findById(parentId)).lean();
  return serializeForJson(hydrated);
}

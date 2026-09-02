import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

export const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);

export const advancedTaskStatusSchema = z.enum([
  "NOT_STARTED",
  "READY",
  "IN_PROGRESS",
  "WAITING",
  "BLOCKED",
  "REVIEW",
  "CLIENT_REVIEW",
  "COMPLETED",
  "CANCELLED",
]);

/**
 * Accepts both status generations, for routes that must keep taking the legacy lowercase values
 * from existing clients. Normalise with `normalizeTaskStatus` before storing or comparing.
 */
export const anyTaskStatusSchema = z.union([taskStatusSchema, advancedTaskStatusSchema]);

export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const taskDependencyTypeSchema = z.enum(["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH"]);
export const workflowNodeTypeSchema = z.enum(["SUBTASK", "MILESTONE", "APPROVAL", "CONDITION", "MERGE", "WAIT", "START", "END"]);
export const taskTemplateStatusSchema = z.enum(["active", "archived"]);

export const workflowTemplateSchema = z.enum([
  "custom",
  "client_delivery",
  "lead_to_delivery",
  "marketing_campaign",
  "n8n_automation",
]);

export const subTaskSchema = z.object({
  _id: objectIdSchema.optional(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  status: taskStatusSchema.optional(),
  dueAt: z.coerce.date().nullable().optional(),
  assignedToUserId: objectIdSchema.nullable().optional(),
  sourceSheet: z.string().trim().max(120).optional(),
  sourceRow: z.coerce.number().int().min(1).nullable().optional(),
  order: z.coerce.number().int().min(0).optional(),
});

export const taskFlowStepSchema = z.object({
  key: z.string().trim().min(1).max(80),
  title: z.string().trim().min(2).max(120),
  status: taskStatusSchema.optional(),
  order: z.coerce.number().int().min(0).optional(),
});

export const checklistItemSchema = z.object({
  _id: objectIdSchema.optional(),
  title: z.string().trim().min(1).max(240),
  completed: z.coerce.boolean().optional(),
  order: z.coerce.number().int().min(0).optional(),
});

export const createTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).optional(),
    code: z.string().trim().min(2).max(80).optional(),
    status: anyTaskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    startAt: z.coerce.date().nullable().optional(),
    dueAt: z.coerce.date().nullable().optional(),
    estimatedEffortHours: z.coerce.number().min(0).nullable().optional(),
    progressPercent: z.coerce.number().min(0).max(100).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
    stage: z.string().trim().max(120).optional(),
    assignedToUserId: objectIdSchema.optional(),
    leadId: objectIdSchema.optional(),
    clientId: objectIdSchema.optional(),
    projectId: objectIdSchema.optional(),
    kpiId: objectIdSchema.optional(),
    parentTaskId: objectIdSchema.optional(),

  })
  .refine((value) => !value.startAt || !value.dueAt || value.startAt <= value.dueAt, {
    message: "Due date must be on or after the start date.",
    path: ["dueAt"],
  });

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    status: anyTaskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    startAt: z.coerce.date().nullable().optional(),
    dueAt: z.coerce.date().nullable().optional(),
    estimatedEffortHours: z.coerce.number().min(0).nullable().optional(),
    actualEffortHours: z.coerce.number().min(0).nullable().optional(),
    progressPercent: z.coerce.number().min(0).max(100).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
    stage: z.string().trim().max(120).optional(),
    assignedToUserId: objectIdSchema.optional(),
    kpiId: objectIdSchema.nullable().optional(),
    projectId: objectIdSchema.nullable().optional(),
    leadId: objectIdSchema.nullable().optional(),
    clientId: objectIdSchema.nullable().optional(),
    parentTaskId: objectIdSchema.nullable().optional(),
    checklist: z.array(checklistItemSchema).max(300).optional(),
  })
  .refine((value) => !value.startAt || !value.dueAt || value.startAt <= value.dueAt, {
    message: "Due date must be on or after the start date.",
    path: ["dueAt"],
  });

export const duplicateTaskSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  includeChildren: z.coerce.boolean().default(true),
  includeDependencies: z.coerce.boolean().default(true),
  resetStatus: z.coerce.boolean().default(true),
});

export const bulkUpdateTasksSchema = z.object({
  taskIds: z.array(objectIdSchema).min(1).max(1000),
  patch: z
    .object({
      status: anyTaskStatusSchema.optional(),
      priority: taskPrioritySchema.optional(),
      assignedToUserId: objectIdSchema.optional(),
      dueAt: z.coerce.date().nullable().optional(),
      stage: z.string().trim().max(120).optional(),
      projectId: objectIdSchema.nullable().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one update field is required.",
    }),
});

export const taskAttachmentSchema = z.object({
  _id: objectIdSchema.optional(),
  name: z.string().trim().min(1).max(200),
  url: z.string().trim().min(1).max(1000),
  mimeType: z.string().trim().max(120).optional(),
  sizeBytes: z.coerce.number().int().min(0).nullable().optional(),
});

export const taskCommentInputSchema = z.object({
  _id: objectIdSchema.optional(),
  body: z.string().trim().min(1).max(5000),
});

const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(30)
  .optional();

export const createAdvancedSubtaskSchema = z.object({
  code: z.string().trim().min(2).max(80).optional(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional(),
  projectId: objectIdSchema.nullable().optional(),
  status: advancedTaskStatusSchema.default("NOT_STARTED"),
  priority: taskPrioritySchema.default("MEDIUM"),
  assignedToUserId: objectIdSchema.optional(),
  startAt: z.coerce.date().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  estimatedEffortHours: z.coerce.number().min(0).nullable().optional(),
  actualEffortHours: z.coerce.number().min(0).nullable().optional(),
  progressPercent: z.coerce.number().min(0).max(100).default(0),
  tags: tagsSchema,
  stage: z.string().trim().max(120).optional(),
  attachments: z.array(taskAttachmentSchema).max(100).optional(),
  comments: z.array(taskCommentInputSchema).max(100).optional(),
  checklist: z.array(checklistItemSchema).max(300).optional(),
  workflowNodeType: workflowNodeTypeSchema.default("SUBTASK"),
  workflowGroup: z.string().trim().max(120).optional(),
  workflowDecision: z.string().trim().toUpperCase().max(40).optional(),
});

export const updateAdvancedSubtaskSchema = createAdvancedSubtaskSchema
  .partial()
  .extend({
    assignedToUserId: objectIdSchema.nullable().optional(),
  });

export const reorderSubtasksSchema = z.object({
  subtasks: z
    .array(
      z.object({
        id: objectIdSchema,
        order: z.coerce.number().int().min(0),
      }),
    )
    .min(1)
    .max(1000),
});

export const updateWorkflowLayoutSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: objectIdSchema,
        positionX: z.coerce.number().finite(),
        positionY: z.coerce.number().finite(),
        width: z.coerce.number().min(180).max(520).nullable().optional(),
        collapsed: z.coerce.boolean().optional(),
        group: z.string().trim().max(120).optional(),
      }),
    )
    .max(1000),
  stages: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(120),
        name: z.string().trim().min(1).max(120),
        color: z.string().trim().max(40).default("accent"),
        collapsed: z.coerce.boolean().default(false),
        order: z.coerce.number().int().min(0),
      }),
    )
    .max(100)
    .optional(),
});

export const bulkUpdateSubtasksSchema = z.object({
  subtaskIds: z.array(objectIdSchema).min(1).max(1000),
  patch: updateAdvancedSubtaskSchema.omit({ comments: true }).refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  }),
});

export const bulkAssignSubtasksSchema = z.object({
  subtaskIds: z.array(objectIdSchema).min(1).max(1000),
  assignedToUserId: objectIdSchema,
});

export const rescheduleSubtaskSchema = z
  .object({
    startAt: z.coerce.date().nullable().optional(),
    dueAt: z.coerce.date().nullable().optional(),
    shiftDependents: z.coerce.boolean().default(false),
  })
  .refine((value) => value.startAt !== undefined || value.dueAt !== undefined, {
    message: "Start date or due date is required.",
  });

export const createSubtaskDependencySchema = z.object({
  predecessorSubtaskId: objectIdSchema,
  successorSubtaskId: objectIdSchema,
  dependencyType: taskDependencyTypeSchema.default("FINISH_TO_START"),
  lagDuration: z.coerce.number().min(0).nullable().optional(),
  branchKey: z.string().trim().toUpperCase().max(40).optional(),
  branchLabel: z.string().trim().max(80).optional(),
});

export const importFieldSchema = z.enum([
  "ignore",
  "subtaskId",
  "name",
  "description",
  "assignedTo",
  "assigneeEmail",
  "priority",
  "status",
  "startDate",
  "dueDate",
  "estimatedHours",
  "dependsOn",
  "stage",
  "tags",
]);

export const importMappingSchema = z.record(z.string(), importFieldSchema);

export const validateSubtaskImportSchema = z.object({
  importJobId: objectIdSchema,
  mapping: importMappingSchema,
});

export const executeSubtaskImportSchema = validateSubtaskImportSchema.extend({
  importValidRowsOnly: z.coerce.boolean().default(true),
});

export const taskTemplateStageSchema = z.object({
  key: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  color: z.string().trim().max(40).default("accent"),
  collapsed: z.coerce.boolean().default(false),
  order: z.coerce.number().int().min(0),
});

export const taskTemplateNodeSchema = z.object({
  key: z.string().trim().min(1).max(120),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional(),
  stageKey: z.string().trim().max(120).optional(),
  status: advancedTaskStatusSchema.default("NOT_STARTED"),
  priority: taskPrioritySchema.default("MEDIUM"),
  workflowNodeType: workflowNodeTypeSchema.default("SUBTASK"),
  estimatedDurationDays: z.coerce.number().min(0).max(365).default(1),
  estimatedEffortHours: z.coerce.number().min(0).nullable().optional(),
  tags: tagsSchema,
  positionX: z.coerce.number().finite().nullable().optional(),
  positionY: z.coerce.number().finite().nullable().optional(),
  width: z.coerce.number().min(180).max(520).nullable().optional(),
  order: z.coerce.number().int().min(0),
  assignedToUserId: objectIdSchema.nullable().optional(),
});

export const taskTemplateDependencySchema = z.object({
  predecessorKey: z.string().trim().min(1).max(120),
  successorKey: z.string().trim().min(1).max(120),
  dependencyType: taskDependencyTypeSchema.default("FINISH_TO_START"),
  lagDuration: z.coerce.number().min(0).nullable().optional(),
  branchKey: z.string().trim().toUpperCase().max(40).optional(),
  branchLabel: z.string().trim().max(80).optional(),
});

export const createTaskWorkflowTemplateSchema = z.object({
  name: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(120).optional(),
  copyAssignees: z.coerce.boolean().default(false),
  taskTitle: z.string().trim().min(3).max(200),
  taskDescription: z.string().trim().max(2000).optional(),
  taskPriority: taskPrioritySchema.default("MEDIUM"),
  estimatedDurationDays: z.coerce.number().min(0).max(3650).default(0),
  stages: z.array(taskTemplateStageSchema).max(100).default([]),
  nodes: z.array(taskTemplateNodeSchema).min(1).max(1000),
  dependencies: z.array(taskTemplateDependencySchema).max(2000).default([]),
});

export const updateTaskWorkflowTemplateSchema = createTaskWorkflowTemplateSchema.partial().extend({
  status: taskTemplateStatusSchema.optional(),
});

export const createTemplateFromTaskSchema = z.object({
  taskId: objectIdSchema,
  name: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(120).optional(),
  copyAssignees: z.coerce.boolean().default(false),
});

export const duplicateTaskWorkflowTemplateSchema = z.object({
  name: z.string().trim().min(3).max(160).optional(),
});

export const applyTaskWorkflowTemplateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  assignedToUserId: objectIdSchema.optional(),
  startAt: z.coerce.date().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  projectId: objectIdSchema.nullable().optional(),
  leadId: objectIdSchema.nullable().optional(),
  clientId: objectIdSchema.nullable().optional(),
  copyAssignees: z.coerce.boolean().default(false),
});

export const taskAiAssistantModeSchema = z.enum([
  "generate_subtasks",
  "break_down_subtask",
  "suggest_dependencies",
  "generate_workflow",
  "detect_problems",
]);

export const taskAiAssistantSchema = z.object({
  mode: taskAiAssistantModeSchema,
  prompt: z.string().trim().max(4000).optional(),
  subtaskId: objectIdSchema.optional(),
});

export const taskAnalyticsStatusSchema = z.enum([
  "todo",
  "in_progress",
  "done",
  "NOT_STARTED",
  "READY",
  "IN_PROGRESS",
  "WAITING",
  "BLOCKED",
  "REVIEW",
  "CLIENT_REVIEW",
  "COMPLETED",
  "CANCELLED",
]);

export const taskAnalyticsFiltersSchema = z
  .object({
    projectId: objectIdSchema.optional(),
    userId: objectIdSchema.optional(),
    status: taskAnalyticsStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    stage: z.string().trim().max(120).optional(),
  })
  .refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
    message: "Start date must be before end date.",
    path: ["endDate"],
  });

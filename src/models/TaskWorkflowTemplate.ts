import { model, models, Schema, type InferSchemaType } from "mongoose";

const templateStatusValues = ["active", "archived"] as const;
const taskPriorityValues = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const workflowNodeTypeValues = ["SUBTASK", "MILESTONE", "APPROVAL", "CONDITION", "MERGE", "WAIT", "START", "END"] as const;
const dependencyTypeValues = ["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH"] as const;

const templateStageSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 120 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    color: { type: String, trim: true, maxlength: 40, default: "accent" },
    collapsed: { type: Boolean, default: false },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const templateNodeSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 120 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000, default: "" },
    stageKey: { type: String, trim: true, maxlength: 120, default: "" },
    status: { type: String, default: "NOT_STARTED" },
    priority: { type: String, enum: taskPriorityValues, default: "MEDIUM", required: true },
    workflowNodeType: { type: String, enum: workflowNodeTypeValues, default: "SUBTASK", required: true },
    estimatedDurationDays: { type: Number, min: 0, default: 1 },
    estimatedEffortHours: { type: Number, min: 0, default: null },
    tags: { type: [String], default: [] },
    positionX: { type: Number, default: null },
    positionY: { type: Number, default: null },
    width: { type: Number, min: 180, max: 520, default: null },
    order: { type: Number, required: true, min: 0 },
    assignedToUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false },
);

const templateDependencySchema = new Schema(
  {
    predecessorKey: { type: String, required: true, trim: true, maxlength: 120 },
    successorKey: { type: String, required: true, trim: true, maxlength: 120 },
    dependencyType: { type: String, enum: dependencyTypeValues, default: "FINISH_TO_START", required: true },
    lagDuration: { type: Number, min: 0, default: null },
    branchKey: { type: String, trim: true, uppercase: true, maxlength: 40, default: "" },
    branchLabel: { type: String, trim: true, maxlength: 80, default: "" },
  },
  { _id: false },
);

const taskWorkflowTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 160, index: true },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    status: { type: String, enum: templateStatusValues, default: "active", required: true, index: true },
    category: { type: String, trim: true, maxlength: 120, default: "General" },
    isSystem: { type: Boolean, default: false, index: true },
    copyAssignees: { type: Boolean, default: false },
    taskTitle: { type: String, required: true, trim: true, maxlength: 200 },
    taskDescription: { type: String, trim: true, maxlength: 2000, default: "" },
    taskPriority: { type: String, enum: taskPriorityValues, default: "MEDIUM", required: true },
    estimatedDurationDays: { type: Number, min: 0, default: 0 },
    stages: { type: [templateStageSchema], default: [] },
    nodes: { type: [templateNodeSchema], default: [] },
    dependencies: { type: [templateDependencySchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

taskWorkflowTemplateSchema.index({ status: 1, name: 1 });
taskWorkflowTemplateSchema.index({ name: 1, status: 1 }, { unique: true });

export type TaskWorkflowTemplateDocument = InferSchemaType<typeof taskWorkflowTemplateSchema>;

export const TaskWorkflowTemplateModel =
  models.TaskWorkflowTemplate || model("TaskWorkflowTemplate", taskWorkflowTemplateSchema);

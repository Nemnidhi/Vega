import { deleteModel, model, models, Schema, type InferSchemaType } from "mongoose";

// Two generations of status values. The lowercase trio is legacy and must stay in the enum for
// existing rows to keep loading; nothing writes it any more. Normalise with normalizeTaskStatus()
// before comparing - see lib/tasks/status.ts.
const taskStatusValues = [
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
] as const;

const taskPriorityValues = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const workflowNodeTypeValues = ["SUBTASK", "MILESTONE", "APPROVAL", "CONDITION", "MERGE", "WAIT", "START", "END"] as const;

const workflowStageSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 120 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    color: { type: String, trim: true, maxlength: 40, default: "accent" },
    collapsed: { type: Boolean, default: false },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const taskAttachmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    url: { type: String, required: true, trim: true, maxlength: 1000 },
    mimeType: { type: String, trim: true, maxlength: 120, default: "" },
    sizeBytes: { type: Number, min: 0, default: null },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    uploadedAt: { type: Date, default: Date.now, required: true },
  },
  { _id: true },
);

const taskCommentSchema = new Schema(
  {
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now, required: true },
    updatedAt: { type: Date, default: null },
  },
  { _id: true },
);

const checklistItemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 240 },
    completed: { type: Boolean, default: false, required: true },
    completedAt: { type: Date, default: null },
    completedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const subTaskSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    status: {
      type: String,
      enum: taskStatusValues,
      default: "todo",
      required: true,
    },
    dueAt: { type: Date, default: null },
    assignedToUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    completedAt: { type: Date, default: null },
    sourceSheet: { type: String, trim: true, maxlength: 120, default: "" },
    sourceRow: { type: Number, default: null },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const taskFlowStepSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    status: {
      type: String,
      enum: taskStatusValues,
      default: "todo",
      required: true,
    },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const taskSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    status: {
      type: String,
      enum: taskStatusValues,
      default: "todo",
      required: true,
      index: true,
    },
    dueAt: { type: Date, default: null, index: true },
    completedAt: { type: Date, default: null },
    assignedToUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    code: { type: String, trim: true, uppercase: true, maxlength: 80, unique: true, sparse: true, index: true },
    // Optional links to what the task is actually about. These are optional because not every
    // task is tied to a specific record.
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    parentTaskId: { type: Schema.Types.ObjectId, ref: "Task", default: null, index: true },
    rootTaskId: { type: Schema.Types.ObjectId, ref: "Task", default: null, index: true },
    // A task counts toward a KPI's progress when it's marked done - see models/Kpi.ts. Optional:
    // most tasks won't be tied to a KPI.
    kpiId: { type: Schema.Types.ObjectId, ref: "Kpi", default: null, index: true },
    priority: {
      type: String,
      enum: taskPriorityValues,
      default: "MEDIUM",
      required: true,
      index: true,
    },
    startAt: { type: Date, default: null, index: true },
    estimatedEffortHours: { type: Number, min: 0, default: null },
    actualEffortHours: { type: Number, min: 0, default: null },
    progressPercent: { type: Number, min: 0, max: 100, default: 0 },
    tags: { type: [String], default: [] },
    stage: { type: String, trim: true, maxlength: 120, default: "" },
    order: { type: Number, min: 0, default: 0, index: true },
    archivedAt: { type: Date, default: null, index: true },
    archivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    workflowPositionX: { type: Number, default: null },
    workflowPositionY: { type: Number, default: null },
    workflowWidth: { type: Number, min: 180, max: 520, default: null },
    workflowCollapsed: { type: Boolean, default: false },
    workflowGroup: { type: String, trim: true, maxlength: 120, default: "" },
    workflowNodeType: {
      type: String,
      enum: workflowNodeTypeValues,
      default: "SUBTASK",
      required: true,
      index: true,
    },
    workflowDecision: { type: String, trim: true, uppercase: true, maxlength: 40, default: "" },
    workflowStages: { type: [workflowStageSchema], default: [] },
    importJobId: { type: Schema.Types.ObjectId, ref: "ImportJob", default: null, index: true },
    importExternalId: { type: String, trim: true, maxlength: 120, default: "" },
    importFingerprint: { type: String, trim: true, maxlength: 128, default: "", index: true },
    attachments: { type: [taskAttachmentSchema], default: [] },
    comments: { type: [taskCommentSchema], default: [] },
    checklist: { type: [checklistItemSchema], default: [] },
    /**
     * @deprecated Frozen. Nothing writes this any more.
     *
     * A canned template name that predates real child tasks and workflow stages. Kept on the
     * schema so historical documents keep loading; it is not part of any write path.
     */
    workflowTemplate: {
      type: String,
      enum: ["custom", "client_delivery", "lead_to_delivery", "marketing_campaign", "n8n_automation"],
      default: "custom",
      required: true,
    },
    /**
     * @deprecated Frozen. Superseded by child Task documents and TaskDependency edges, which the
     * workspace, the dependency engine and the canvas all actually read.
     */
    flowSteps: {
      type: [taskFlowStepSchema],
      default: [],
    },
    /**
     * @deprecated Legacy embedded subtasks. Read-only - nothing writes this any more.
     *
     * Rows created here were invisible to the Task Workspace, the dependency engine and the
     * workflow canvas, because those all operate on child Task documents (`parentTaskId`).
     * `scripts/migrate-embedded-subtasks.ts` moves surviving rows across. The path stays on the
     * schema so historical documents keep loading until that migration is verified in production.
     */
    subTasks: {
      type: [subTaskSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

taskSchema.index({ parentTaskId: 1, order: 1, createdAt: 1 });
taskSchema.index({ parentTaskId: 1, status: 1, priority: 1 });
taskSchema.index({ projectId: 1, parentTaskId: 1 });
taskSchema.index({ projectId: 1, status: 1, dueAt: 1 });
taskSchema.index({ assignedToUserId: 1, status: 1, dueAt: 1 });
taskSchema.index({ parentTaskId: 1, workflowNodeType: 1 });
taskSchema.index(
  { parentTaskId: 1, importFingerprint: 1 },
  { unique: true, partialFilterExpression: { importFingerprint: { $type: "string", $gt: "" } } },
);

export type TaskDocument = InferSchemaType<typeof taskSchema>;

if (
  process.env.NODE_ENV !== "production" &&
  models.Task &&
  (!models.Task.schema.path("subTasks") ||
    !models.Task.schema.path("parentTaskId") ||
    !models.Task.schema.path("archivedAt"))
) {
  deleteModel("Task");
}

export const TaskModel = models.Task || model("Task", taskSchema);

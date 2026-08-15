import { model, models, Schema, type InferSchemaType } from "mongoose";

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
      enum: ["todo", "in_progress", "done"],
      default: "todo",
      required: true,
      index: true,
    },
    dueAt: { type: Date, default: null, index: true },
    completedAt: { type: Date, default: null },
    assignedToUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Optional links to what the task is actually about - same dual-link spirit as the rest of
    // the codebase's Client/Lead/Project references, all optional since not every task is tied
    // to a specific record.
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    // A task counts toward a KPI's progress when it's marked done - see models/Kpi.ts. Optional:
    // most tasks won't be tied to a KPI.
    kpiId: { type: Schema.Types.ObjectId, ref: "Kpi", default: null, index: true },
  },
  {
    timestamps: true,
  },
);

export type TaskDocument = InferSchemaType<typeof taskSchema>;

export const TaskModel = models.Task || model("Task", taskSchema);

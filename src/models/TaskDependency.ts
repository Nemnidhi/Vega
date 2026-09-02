import { model, models, Schema, type InferSchemaType } from "mongoose";

const dependencyTypeValues = ["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH"] as const;

const taskDependencySchema = new Schema(
  {
    parentTaskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    predecessorSubtaskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    successorSubtaskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    dependencyType: {
      type: String,
      enum: dependencyTypeValues,
      default: "FINISH_TO_START",
      required: true,
      index: true,
    },
    lagDuration: { type: Number, min: 0, default: null },
    branchKey: { type: String, trim: true, uppercase: true, maxlength: 40, default: "" },
    branchLabel: { type: String, trim: true, maxlength: 80, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

taskDependencySchema.index(
  { predecessorSubtaskId: 1, successorSubtaskId: 1, dependencyType: 1 },
  { unique: true },
);
taskDependencySchema.index({ successorSubtaskId: 1, createdAt: 1 });
taskDependencySchema.index({ parentTaskId: 1, predecessorSubtaskId: 1 });
taskDependencySchema.index({ parentTaskId: 1, successorSubtaskId: 1 });

export type TaskDependencyDocument = InferSchemaType<typeof taskDependencySchema>;

export const TaskDependencyModel =
  models.TaskDependency || model("TaskDependency", taskDependencySchema);

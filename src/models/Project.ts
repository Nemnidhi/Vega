import { model, models, Schema, type InferSchemaType } from "mongoose";

const projectTaskSchema = new Schema(
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
      enum: ["todo", "in_progress", "blocked", "done"],
      default: "todo",
      required: true,
      index: true,
    },
    assignedDeveloperId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    completedAt: { type: Date, default: null },
    completedByDeveloperId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    completionAlertPending: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  },
);

const projectSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    status: {
      type: String,
      enum: ["planned", "in_progress", "on_hold", "completed"],
      default: "planned",
      required: true,
      index: true,
    },
    assignedDeveloperId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tasks: { type: [projectTaskSchema], default: [] },
  },
  {
    timestamps: true,
  },
);

projectSchema.index({ assignedDeveloperId: 1, updatedAt: -1 });
projectSchema.index({ status: 1, updatedAt: -1 });

export type ProjectDocument = InferSchemaType<typeof projectSchema>;

const existingProjectModel = models.Project;

// In dev HMR, an older cached model can miss newly added task fields and break populate().
if (existingProjectModel && !existingProjectModel.schema.path("tasks.completedByDeveloperId")) {
  delete models.Project;
}

export const ProjectModel = models.Project || model("Project", projectSchema);

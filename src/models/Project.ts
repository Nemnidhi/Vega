import { deleteModel, model, models, Schema, type InferSchemaType } from "mongoose";

/**
 * Project is a thin delivery container. It deliberately carries NO embedded task array.
 *
 * The version of this model that existed at 4c919d5 had a `tasks[]` subdocument array with its own
 * assignee, completion and history fields, which duplicated the Task collection and was invisible
 * to the dependency engine and the workflow canvas. That array is not coming back - execution work
 * lives in Task documents that point here via `Task.projectId`, and nowhere else.
 */

const projectStatusValues = [
  "planned",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
] as const;

const projectTeamMemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, trim: true, maxlength: 80, default: "" },
    addedAt: { type: Date, default: Date.now, required: true },
  },
  { _id: false },
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
    code: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 80,
      unique: true,
      sparse: true,
      index: true,
    },
    status: {
      type: String,
      enum: projectStatusValues,
      default: "planned",
      required: true,
      index: true,
    },
    // Commercial spine. All optional: a project can be created before every upstream record
    // exists, and the business gates are enforced in the workflow layer, not by requiring these.
    clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
    scopeManifestId: { type: Schema.Types.ObjectId, ref: "ScopeManifest", default: null, index: true },
    proposalId: { type: Schema.Types.ObjectId, ref: "Proposal", default: null, index: true },
    projectManagerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    team: { type: [projectTeamMemberSchema], default: [] },
    startDate: { type: Date, default: null },
    targetEndDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  {
    timestamps: true,
  },
);

projectSchema.index({ status: 1, updatedAt: -1 });
projectSchema.index({ clientId: 1, status: 1 });
projectSchema.index({ projectManagerId: 1, status: 1 });
projectSchema.index({ "team.userId": 1, status: 1 });

export type ProjectDocument = InferSchemaType<typeof projectSchema>;

// In dev HMR an older cached model can survive with the legacy embedded tasks[] path, which would
// silently resurrect the duplicated task system. Drop it if we see that shape.
if (process.env.NODE_ENV !== "production" && models.Project && models.Project.schema.path("tasks")) {
  deleteModel("Project");
}

export const ProjectModel = models.Project || model("Project", projectSchema);

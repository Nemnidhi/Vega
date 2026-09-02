import { model, models, Schema, type InferSchemaType } from "mongoose";

const kpiSchema = new Schema(
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
      maxlength: 1000,
      default: "",
    },
    // Target is a count of linked Tasks marked "done" - progress is computed at read time from
    // Task.kpiId, not stored/duplicated here. See lib/kpi/progress.ts.
    target: { type: Number, required: true, min: 1 },
    period: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
      required: true,
    },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true, index: true },
    // Assigned to a role (a team-wide target any task tagged to it contributes to) and/or a
    // specific user (a personal target) - at least one is required, both may be set at once.
    assignedRole: {
      type: String,
      enum: ["admin", "partner", "sales", "digital_marketing", "project_manager", "developer"],
      default: null,
      index: true,
    },
    assignedUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
  },
);

kpiSchema.pre("validate", function validateAssignment() {
  if (!this.assignedRole && !this.assignedUserId) {
    throw new Error("A KPI must be assigned to a role, a user, or both.");
  }
});

export type KpiDocument = InferSchemaType<typeof kpiSchema>;

export const KpiModel = models.Kpi || model("Kpi", kpiSchema);

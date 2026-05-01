import { model, models, Schema, type InferSchemaType } from "mongoose";

const scopeSectionSchema = new Schema(
  {
    heading: { type: String, required: true, trim: true, maxlength: 150 },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: false },
);

const scopeManifestSchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, unique: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    businessObjective: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    confirmedDeliverables: [{ type: String, required: true, trim: true, maxlength: 300 }],
    exclusions: [{ type: String, required: true, trim: true, maxlength: 300 }],
    clientResponsibilities: [{ type: String, required: true, trim: true, maxlength: 300 }],
    timelineAssumptions: [{ type: String, required: true, trim: true, maxlength: 300 }],
    paymentMilestones: {
      type: [scopeSectionSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => Array.isArray(value) && value.length > 0,
        message: "At least one payment milestone is required",
      },
    },
    revisionLimits: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    maintenanceTerms: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    changeOrderRules: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    isCompleted: { type: Boolean, default: false, index: true },
    signedAt: { type: Date, default: null },
    preparedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

scopeManifestSchema.path("confirmedDeliverables").validate({
  validator: (value: unknown[]) => Array.isArray(value) && value.length > 0,
  message: "At least one deliverable is required",
});

export type ScopeManifestDocument = InferSchemaType<typeof scopeManifestSchema>;

export const ScopeManifestModel =
  models.ScopeManifest || model("ScopeManifest", scopeManifestSchema);

import { model, models, Schema, type InferSchemaType } from "mongoose";

const milestoneSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
    dueBy: { type: Date, default: null },
    currency: { type: String, enum: ["INR", "USD"], default: "INR", required: true },
  },
  { _id: false },
);

const pricingLineSchema = new Schema(
  {
    componentId: { type: Schema.Types.ObjectId, ref: "PricingComponent", default: null },
    label: { type: String, required: true, trim: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    currency: { type: String, enum: ["INR", "USD"], default: "INR", required: true },
  },
  { _id: false },
);

const proposalSchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    scopeManifestId: { type: Schema.Types.ObjectId, ref: "ScopeManifest", required: true, index: true },
    version: { type: Number, required: true, default: 1, min: 1 },
    status: {
      type: String,
      enum: ["draft", "generated", "sent", "viewed", "signed", "rejected"],
      default: "draft",
      required: true,
      index: true,
    },
    projectSummary: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },
    scopeOfWork: [{ type: String, required: true, trim: true, maxlength: 300 }],
    exclusions: [{ type: String, required: true, trim: true, maxlength: 300 }],
    timeline: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    milestones: { type: [milestoneSchema], default: [] },
    pricing: { type: [pricingLineSchema], required: true, default: [] },
    paymentSchedule: { type: [milestoneSchema], required: true, default: [] },
    changeOrderClause: { type: String, required: true, trim: true, minlength: 5, maxlength: 2000 },
    signatureBlock: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    approvalStatus: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "draft",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

proposalSchema.index({ leadId: 1, version: -1 }, { unique: true });

export type ProposalDocument = InferSchemaType<typeof proposalSchema>;

export const ProposalModel = models.Proposal || model("Proposal", proposalSchema);

import { model, models, Schema, type InferSchemaType } from "mongoose";

const leadBudgetSchema = new Schema(
  {
    min: { type: Number, min: 0, required: true },
    max: { type: Number, min: 0, required: true },
    currency: { type: String, enum: ["INR", "USD"], default: "INR", required: true },
  },
  { _id: false },
);

const leadSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    contactName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
      index: true,
    },
    phone: { type: String, trim: true, maxlength: 30 },
    source: {
      type: String,
      enum: ["website", "referral", "cold_outreach", "paid_ads", "event", "partner", "other"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["new", "contacted", "qualified", "proposal_sent", "negotiation", "closed_won", "closed_lost"],
      default: "new",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["software_request", "infrastructure", "legal_automation", "retainer_enterprise", "other"],
      required: true,
      index: true,
    },
    urgency: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      index: true,
    },
    budget: { type: leadBudgetSchema, default: null },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 5000,
    },
    sourceDomain: { type: String, trim: true, lowercase: true, maxlength: 180, index: true },
    sourcePath: { type: String, trim: true, maxlength: 500 },
    sourceReferrer: { type: String, trim: true, maxlength: 1000 },
    score: { type: Number, min: 0, max: 100, default: 0, index: true },
    priorityBand: {
      type: String,
      enum: ["heavy_artillery", "standard_sales", "volume_pipeline"],
      default: "volume_pipeline",
      index: true,
    },
    priorityFlag: { type: Boolean, default: false, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null, index: true },
    tags: [{ type: String, trim: true, maxlength: 40 }],
  },
  {
    timestamps: true,
  },
);

leadSchema.index({ status: 1, updatedAt: -1 });
leadSchema.index({ updatedAt: -1 });
leadSchema.index({ priorityBand: 1, score: -1 });
leadSchema.index({ sourceDomain: 1, createdAt: -1 });

export type LeadDocument = InferSchemaType<typeof leadSchema>;

export const LeadModel = models.Lead || model("Lead", leadSchema);

import { model, models, Schema, type InferSchemaType } from "mongoose";

const changeOrderSchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    proposalId: { type: Schema.Types.ObjectId, ref: "Proposal", required: true, index: true },
    scopeManifestId: { type: Schema.Types.ObjectId, ref: "ScopeManifest", required: true, index: true },
    requestedFeature: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    reasonOutOfScope: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    additionalPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["INR", "USD"], default: "INR", required: true },
    timelineImpactDays: { type: Number, required: true, min: 0, default: 0 },
    approvalStatus: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "pending",
      required: true,
      index: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type ChangeOrderDocument = InferSchemaType<typeof changeOrderSchema>;

export const ChangeOrderModel = models.ChangeOrder || model("ChangeOrder", changeOrderSchema);

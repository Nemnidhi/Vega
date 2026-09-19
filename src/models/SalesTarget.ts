import { model, models, Schema, type InferSchemaType } from "mongoose";

const schema = new Schema({
  assignedUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  metric: { type: String, enum: ["revenue", "deals"], required: true },
  period: { type: String, enum: ["monthly", "yearly"], required: true },
  periodKey: { type: String, required: true },
  target: { type: Number, required: true, min: 0.01 },
  achieved: { type: Number, default: 0, min: 0 },
  notes: { type: String, default: "", maxlength: 1000 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  version: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ assignedUserId: 1, metric: 1, period: 1, periodKey: 1 }, { unique: true });
schema.index({ periodKey: -1 });
export type SalesTargetDocument = InferSchemaType<typeof schema>;
export const SalesTargetModel = models.SalesTarget || model("SalesTarget", schema);

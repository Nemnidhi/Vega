import { model, models, Schema, type InferSchemaType } from "mongoose";

const activityLogSchema = new Schema(
  {
    action: {
      type: String,
      enum: [
        "lead_status_changed",
        "proposal_generated",
        "proposal_sent",
        "proposal_signed",
        "scope_manifest_edited",
        "change_order_created",
        "pricing_changed",
      ],
      required: true,
      index: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    entityType: {
      type: String,
      enum: ["lead", "proposal", "scope_manifest", "change_order", "pricing_component"],
      required: true,
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    details: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, trim: true, maxlength: 100 },
    userAgent: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

activityLogSchema.index({ createdAt: -1 });

export type ActivityLogDocument = InferSchemaType<typeof activityLogSchema>;

export const ActivityLogModel = models.ActivityLog || model("ActivityLog", activityLogSchema);

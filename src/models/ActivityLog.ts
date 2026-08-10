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
        "audit_enrichment_completed",
        "audit_classification_completed",
        "audit_report_generated",
        "audit_report_sent",
      ],
      required: true,
      index: true,
    },
    // Optional so cron-triggered audit actions can be logged with no human
    // actor. Interactive actions still always pass one.
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
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

const existingActivityLogModel = models.ActivityLog;
const existingActionEnum = existingActivityLogModel?.schema.path("action")?.options?.enum;

// In dev HMR, an older cached model can predate the audit_* actions.
if (
  existingActivityLogModel &&
  Array.isArray(existingActionEnum) &&
  !existingActionEnum.includes("audit_report_generated")
) {
  delete models.ActivityLog;
}

export const ActivityLogModel = models.ActivityLog || model("ActivityLog", activityLogSchema);

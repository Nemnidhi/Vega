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
        "proposal_viewed",
        "proposal_rejected",
        "scope_manifest_edited",
        "change_order_created",
        "pricing_changed",
        "audit_enrichment_completed",
        "audit_classification_completed",
        "audit_report_generated",
        "audit_report_sent",
        "client_portal_invited",
        "client_portal_activated",
        "blueprint_shared",
        "blueprint_approved",
        "blueprint_rejected",
        "blueprint_self_served",
        "dashboard_event_received",
        "industry_changed",
        "industry_segment_changed",
        "pricing_tier_changed",
        "pricing_package_changed",
        "meeting_booked",
        "meeting_cancelled",
        "meeting_assigned",
      ],
      required: true,
      index: true,
    },
    // Optional so cron-triggered audit actions can be logged with no human
    // actor. Interactive actions still always pass one.
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    entityType: {
      type: String,
      enum: [
        "lead",
        "proposal",
        "scope_manifest",
        "change_order",
        "pricing_component",
        "blueprint",
        "client",
        "industry",
        "industry_segment",
        "pricing_tier",
        "pricing_package",
        "meeting",
      ],
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

// In dev HMR, an older cached model can predate the audit_*/blueprint_*/
// proposal_viewed/proposal_rejected/pricing-catalog/meeting_* actions.
if (
  existingActivityLogModel &&
  Array.isArray(existingActionEnum) &&
  (!existingActionEnum.includes("audit_report_generated") ||
    !existingActionEnum.includes("blueprint_shared") ||
    !existingActionEnum.includes("proposal_viewed") ||
    !existingActionEnum.includes("dashboard_event_received") ||
    !existingActionEnum.includes("pricing_package_changed") ||
    !existingActionEnum.includes("meeting_booked"))
) {
  delete models.ActivityLog;
}

export const ActivityLogModel = models.ActivityLog || model("ActivityLog", activityLogSchema);

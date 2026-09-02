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
        "blueprint_finalized",
        "dashboard_event_received",
        "industry_changed",
        "industry_segment_changed",
        "pricing_tier_changed",
        "pricing_package_changed",
        "meeting_booked",
        "meeting_cancelled",
        "meeting_assigned",
        "subtask_dependency_added",
        "subtask_dependency_removed",
        "subtask_import_completed",
        "subtask_created",
        "subtask_assigned",
        "subtask_reassigned",
        "subtask_ready",
        "subtask_blocked",
        "subtask_completed",
        "subtask_due_approaching",
        "subtask_overdue",
        "subtask_comment_added",
        "subtask_comment_mention",
        "approval_requested",
        "approval_accepted",
        "approval_rejected",
        "workflow_changed",
        "workflow_node_status_changed",
        "workflow_node_decision_changed",
        "workflow_node_rescheduled",
        "task_created",
        "task_updated",
        "task_assigned",
        "task_status_changed",
        "task_archived",
        "task_restored",
        "task_duplicated",
        "task_bulk_updated",
        "subtask_reordered",
        "project_created",
        "project_updated",
        "project_archived",
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
        "task",
        "project",
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
activityLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export type ActivityLogDocument = InferSchemaType<typeof activityLogSchema>;

const existingActivityLogModel = models.ActivityLog;
const existingActionEnum = existingActivityLogModel?.schema.path("action")?.options?.enum;
const existingEntityEnum = existingActivityLogModel?.schema.path("entityType")?.options?.enum;

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
    !existingActionEnum.includes("meeting_booked") ||
    !existingActionEnum.includes("blueprint_finalized") ||
    !existingActionEnum.includes("subtask_dependency_added") ||
    !existingActionEnum.includes("subtask_import_completed") ||
    !existingActionEnum.includes("subtask_created") ||
    !existingActionEnum.includes("subtask_assigned") ||
    !existingActionEnum.includes("subtask_reassigned") ||
    !existingActionEnum.includes("subtask_ready") ||
    !existingActionEnum.includes("subtask_blocked") ||
    !existingActionEnum.includes("subtask_completed") ||
    !existingActionEnum.includes("subtask_due_approaching") ||
    !existingActionEnum.includes("subtask_overdue") ||
    !existingActionEnum.includes("subtask_comment_added") ||
    !existingActionEnum.includes("subtask_comment_mention") ||
    !existingActionEnum.includes("approval_requested") ||
    !existingActionEnum.includes("approval_accepted") ||
    !existingActionEnum.includes("approval_rejected") ||
    !existingActionEnum.includes("workflow_changed") ||
    !existingActionEnum.includes("workflow_node_status_changed") ||
    !existingActionEnum.includes("workflow_node_rescheduled") ||
    !existingActionEnum.includes("task_created") ||
    !existingActionEnum.includes("task_status_changed") ||
    !existingActionEnum.includes("task_archived") ||
    !existingActionEnum.includes("project_created") ||
    (Array.isArray(existingEntityEnum) &&
      (!existingEntityEnum.includes("task") || !existingEntityEnum.includes("project"))))
) {
  delete models.ActivityLog;
}

export const ActivityLogModel = models.ActivityLog || model("ActivityLog", activityLogSchema);

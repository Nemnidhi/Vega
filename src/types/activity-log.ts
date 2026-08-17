import type { BaseDocument, ObjectId } from "@/types/common";

export type ActivityAction =
  | "lead_status_changed"
  | "proposal_generated"
  | "proposal_sent"
  | "proposal_signed"
  | "proposal_viewed"
  | "proposal_rejected"
  | "scope_manifest_edited"
  | "change_order_created"
  | "pricing_changed"
  | "industry_changed"
  | "industry_segment_changed"
  | "pricing_tier_changed"
  | "pricing_package_changed"
  | "audit_enrichment_completed"
  | "audit_classification_completed"
  | "audit_report_generated"
  | "audit_report_sent"
  | "client_portal_invited"
  | "client_portal_activated"
  | "blueprint_shared"
  | "blueprint_approved"
  | "blueprint_rejected"
  | "blueprint_self_served"
  | "dashboard_event_received"
  | "meeting_booked"
  | "meeting_cancelled"
  | "meeting_assigned";

export interface ActivityLog extends BaseDocument {
  action: ActivityAction;
  /** Null for cron-triggered audit actions, which have no human actor. */
  actorId: ObjectId | null;
  entityType:
    | "lead"
    | "proposal"
    | "scope_manifest"
    | "change_order"
    | "pricing_component"
    | "blueprint"
    | "client"
    | "industry"
    | "industry_segment"
    | "pricing_tier"
    | "pricing_package"
    | "meeting";
  entityId: ObjectId;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

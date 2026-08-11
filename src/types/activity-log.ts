import type { BaseDocument, ObjectId } from "@/types/common";

export type ActivityAction =
  | "lead_status_changed"
  | "proposal_generated"
  | "proposal_sent"
  | "proposal_signed"
  | "scope_manifest_edited"
  | "change_order_created"
  | "pricing_changed"
  | "audit_enrichment_completed"
  | "audit_classification_completed"
  | "audit_report_generated"
  | "audit_report_sent"
  | "client_portal_invited"
  | "client_portal_activated"
  | "blueprint_shared"
  | "blueprint_approved"
  | "blueprint_rejected";

export interface ActivityLog extends BaseDocument {
  action: ActivityAction;
  /** Null for cron-triggered audit actions, which have no human actor. */
  actorId: ObjectId | null;
  entityType: "lead" | "proposal" | "scope_manifest" | "change_order" | "pricing_component" | "blueprint";
  entityId: ObjectId;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

import type { BaseDocument, ObjectId } from "@/types/common";

export type ActivityAction =
  | "lead_status_changed"
  | "proposal_generated"
  | "proposal_sent"
  | "proposal_signed"
  | "scope_manifest_edited"
  | "change_order_created"
  | "pricing_changed";

export interface ActivityLog extends BaseDocument {
  action: ActivityAction;
  actorId: ObjectId;
  entityType: "lead" | "proposal" | "scope_manifest" | "change_order" | "pricing_component";
  entityId: ObjectId;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

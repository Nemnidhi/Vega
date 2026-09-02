import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ActivityLogModel } from "@/models";
import type { ActivityAction } from "@/types/activity-log";

type LogInput = {
  action: ActivityAction;
  /** Omit for cron-triggered audit actions, which have no human actor. */
  actorId?: string | null;
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
    | "meeting"
    | "task"
    | "project";
  entityId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Records an audit entry. Never throws.
 *
 * Callers await this *after* their primary write has already committed, and these routes are
 * not transactional. An unguarded failure here - an action outside the schema enum, an
 * entityId that isn't an ObjectId reaching `new Types.ObjectId()`, a transient write error -
 * therefore propagated into the route's catch block and returned an error for an operation
 * that had actually succeeded, prompting the user to retry and run it twice.
 *
 * A missing audit row is worth strictly less than a corrupted operation, so failures are
 * logged to the server and swallowed.
 */
export async function logActivity(input: LogInput) {
  try {
    await connectToDatabase();

    await ActivityLogModel.create({
      action: input.action,
      actorId: input.actorId ? new Types.ObjectId(input.actorId) : null,
      entityType: input.entityType,
      entityId: new Types.ObjectId(input.entityId),
      details: input.details ?? {},
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  } catch (error) {
    console.error(
      `logActivity failed (action=${input.action} entityType=${input.entityType} entityId=${input.entityId}):`,
      error,
    );
  }
}

import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ActivityLogModel } from "@/models";
import type { ActivityAction } from "@/types/activity-log";

type LogInput = {
  action: ActivityAction;
  actorId: string;
  entityType: "lead" | "proposal" | "scope_manifest" | "change_order" | "pricing_component";
  entityId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

export async function logActivity(input: LogInput) {
  await connectToDatabase();

  await ActivityLogModel.create({
    action: input.action,
    actorId: new Types.ObjectId(input.actorId),
    entityType: input.entityType,
    entityId: new Types.ObjectId(input.entityId),
    details: input.details ?? {},
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}

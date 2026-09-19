import { Types } from "mongoose";
import { LeadModel } from "@/models/Lead";

export async function assignedLeadCounts(userIds: string[]) {
  if (!userIds.length) return new Map<string, number>();
  const rows = await LeadModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { ownerId: { $in: userIds.map((id) => new Types.ObjectId(id)) } } },
    { $group: { _id: "$ownerId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

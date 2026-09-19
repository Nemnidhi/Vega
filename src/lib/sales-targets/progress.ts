import { Types } from "mongoose";
import { LeadModel } from "@/models/Lead";

export async function closedDealProgress(userIds: string[]) {
  if (!userIds.length) return new Map<string, { revenue: number; deals: number }>();
  const rows = await LeadModel.aggregate<{ _id: { user: Types.ObjectId; month: string }; paise: number; deals: number }>([
    { $match: { status: "closed_won", "closure.salespersonId": { $in: userIds.map((id) => new Types.ObjectId(id)) }, "closure.closedAt": { $type: "date" }, "closure.revenuePaise": { $gte: 0 } } },
    { $group: { _id: { user: "$closure.salespersonId", month: { $dateToString: { date: "$closure.closedAt", format: "%Y-%m", timezone: "Asia/Kolkata" } } }, paise: { $sum: "$closure.revenuePaise" }, deals: { $sum: 1 } } },
  ]);
  const progress = new Map<string, { revenue: number; deals: number }>();
  for (const row of rows) {
    for (const period of [row._id.month, row._id.month.slice(0, 4)]) {
      const key = `${row._id.user}:${period}`;
      const previous = progress.get(key) ?? { revenue: 0, deals: 0 };
      progress.set(key, { revenue: Math.round((previous.revenue + row.paise / 100) * 100) / 100, deals: previous.deals + row.deals });
    }
  }
  return progress;
}

import { LeadAssignmentCursorModel } from "@/models/LeadAssignmentCursor";
import { UserModel } from "@/models/User";

export function rotationOwners(ids: string[], start: number, count: number): Array<string | null> {
  return Array.from({ length: count }, (_, index) => ids.length ? ids[(start + index) % ids.length] : null);
}

// Reserve one contiguous range atomically, shared across workers and intake sources.
// Manual assignments do not consume automatic turns. With a stable active team,
// each complete rotation gives every salesperson one new lead.
export async function allocateLeadOwners(count: number) {
  const users = await UserModel.find({ role: "sales", status: "active" }).sort({ _id: 1 }).select("_id").lean();
  if (!users.length || !count) return rotationOwners([], 0, count);
  try {
    await LeadAssignmentCursorModel.updateOne({ _id: "sales" }, { $setOnInsert: { sequence: 0 } }, { upsert: true });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  const cursor = await LeadAssignmentCursorModel.findOneAndUpdate(
    { _id: "sales" }, { $inc: { sequence: count } }, { returnDocument: "after" },
  ).lean();
  if (!cursor) throw new Error("Lead assignment is temporarily unavailable");
  return rotationOwners(users.map((user) => String(user._id)), cursor.sequence - count, count);
}

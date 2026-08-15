import { Types } from "mongoose";
import { TaskModel } from "@/models";

// Progress is always computed from live Task data, never stored on the Kpi document - a task
// completed after the KPI was created still counts, and there's only one source of truth for
// "is this done" (Task.status), not two that can drift.
export async function computeKpiProgress(kpiId: string, target: number) {
  const completed = await TaskModel.countDocuments({ kpiId, status: "done" });
  const progress = target > 0 ? Math.min(1, completed / target) : 0;
  return { completed, target, progress };
}

export async function computeKpiProgressBulk(kpiIds: string[]) {
  if (kpiIds.length === 0) return new Map<string, number>();
  // Raw aggregation pipelines don't get Mongoose's automatic string->ObjectId cast that
  // .find()/.countDocuments() get - kpiId has to be a real ObjectId here or $match matches nothing.
  const objectIds = kpiIds.map((id) => new Types.ObjectId(id));
  const counts = await TaskModel.aggregate([
    { $match: { kpiId: { $in: objectIds }, status: "done" } },
    { $group: { _id: "$kpiId", completed: { $sum: 1 } } },
  ]);
  return new Map(counts.map((row) => [String(row._id), row.completed as number]));
}

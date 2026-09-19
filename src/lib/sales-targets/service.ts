import { closedDealProgress } from "./progress";
import { assertRoleAccess } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/api/responses";
import { UserModel } from "@/models/User";
import { SalesTargetModel } from "@/models/SalesTarget";
import { createSalesTargetSchema, updateSalesTargetSchema } from "@/lib/validation/sales-target";
import { objectIdSchema } from "@/lib/validation/common";
import { serializeForJson } from "@/lib/utils/serialize";
import type { UserRole } from "@/types/user";

type Actor = { userId: string; role: UserRole };
export async function listSalesTargets(actor: Actor) {
  assertRoleAccess(actor.role, { oneOf: ["admin", "sales"] });
  const targets = await SalesTargetModel.find(actor.role === "admin" ? {} : { assignedUserId: actor.userId })
    .sort({ periodKey: -1, createdAt: -1 }).populate("assignedUserId", "fullName status").populate("updatedBy", "fullName").lean();
  const salespeople = actor.role === "admin" ? await UserModel.find({ role: "sales", status: "active" }).select("fullName").sort({ fullName: 1 }).lean() : [];
  const ids = targets.flatMap((target) => target.assignedUserId ? [String(target.assignedUserId._id)] : []);
  const progress = await closedDealProgress([...new Set(ids)]);
  const withProgress = targets.map((target) => {
    const actual = progress.get(`${target.assignedUserId?._id}:${target.periodKey}`);
    const automaticAchieved = target.metric === "revenue" ? actual?.revenue ?? 0 : actual?.deals ?? 0;
    return { ...target, manualAchieved: target.achieved, automaticAchieved, achieved: target.achieved + automaticAchieved };
  });
  return serializeForJson({ targets: withProgress, salespeople });
}

async function uniqueIndex() {
  // Ensure duplicate protection even when production disables automatic index creation.
  await SalesTargetModel.collection.createIndex({ assignedUserId: 1, metric: 1, period: 1, periodKey: 1 }, { unique: true });
}

export async function createSalesTarget(actor: Actor, input: unknown) {
  assertRoleAccess(actor.role, { oneOf: ["admin"] });
  const payload = createSalesTargetSchema.parse(input);
  if (!await UserModel.exists({ _id: payload.assignedUserId, role: "sales", status: "active" })) throw new ApiError("Choose an active salesperson", 422);
  await uniqueIndex();
  try { return await SalesTargetModel.create({ ...payload, createdBy: actor.userId, updatedBy: actor.userId }); }
  catch (error) { if ((error as { code?: number }).code === 11000) throw new ApiError("A target already exists for this salesperson, metric and period. Edit the existing target.", 409); throw error; }
}

export async function updateSalesTarget(actor: Actor, id: string, input: unknown) {
  assertRoleAccess(actor.role, { oneOf: ["admin"] });
  objectIdSchema.parse(id);
  const { version, ...payload } = updateSalesTargetSchema.parse(input);
  await uniqueIndex();
  try {
    const target = await SalesTargetModel.findOneAndUpdate({ _id: id, version }, { $set: { ...payload, updatedBy: actor.userId }, $inc: { version: 1 } }, { returnDocument: "after", runValidators: true });
    if (!target) {
      if (!await SalesTargetModel.exists({ _id: id })) throw new ApiError("Target not found", 404);
      throw new ApiError("This target changed. Refresh and try again.", 409);
    }
    return target;
  } catch (error) { if ((error as { code?: number }).code === 11000) throw new ApiError("A target already exists for this salesperson, metric and period.", 409); throw error; }
}

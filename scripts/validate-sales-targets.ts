import assert from "node:assert/strict";
import mongoose from "mongoose";
import { UserModel } from "@/models/User";
import { SalesTargetModel } from "@/models/SalesTarget";
import { createSalesTarget, listSalesTargets, updateSalesTarget } from "@/lib/sales-targets/service";
import { createSalesTargetSchema } from "@/lib/validation/sales-target";
import type { SalesTargetsData } from "@/components/sales-targets/sales-targets-workspace";

const uri = process.env.SALES_TARGET_TEST_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27943\/hrms_sales_targets_test_[a-z0-9]+$/.test(uri)) throw new Error("Use a fresh isolated hrms_sales_targets_test_ database at 127.0.0.1:27943");
async function main() {
  await mongoose.connect(uri!);
  const [admin, a, b, inactive] = await UserModel.create([
    { fullName: "Target Admin", email: "admin@test.invalid", role: "admin", status: "active" },
    { fullName: "Sales One", email: "one@test.invalid", role: "sales", status: "active" },
    { fullName: "Sales Two", email: "two@test.invalid", role: "sales", status: "active" },
    { fullName: "Inactive Sales", email: "inactive@test.invalid", role: "sales", status: "inactive" },
  ]);
  const adminActor = { userId: String(admin._id), role: "admin" as const };
  const salesActor = { userId: String(a._id), role: "sales" as const };
  const base = { assignedUserId: String(a._id), metric: "revenue", period: "monthly", periodKey: "2026-09", target: 100000, achieved: 25000, notes: "September revenue" };
  const monthly = await createSalesTarget(adminActor, base);
  const yearly = await createSalesTarget(adminActor, { ...base, period: "yearly", periodKey: "2026", target: 1200000 });
  await createSalesTarget(adminActor, { ...base, metric: "deals", target: 10, achieved: 3 });
  await createSalesTarget(adminActor, { ...base, assignedUserId: String(b._id) });
  const own = await listSalesTargets(salesActor) as SalesTargetsData;
  assert.equal(own.targets.length, 3);
  assert.ok(own.targets.every((item) => item.assignedUserId?._id === String(a._id)));
  assert.equal(own.salespeople.length, 0);
  const all = await listSalesTargets(adminActor) as SalesTargetsData;
  assert.equal(all.targets.length, 4); assert.equal(all.salespeople.length, 2);
  await assert.rejects(createSalesTarget(salesActor, base), /Forbidden/);
  await assert.rejects(updateSalesTarget(salesActor, String(monthly._id), { ...base, version: 0 }), /Forbidden/);
  await assert.rejects(listSalesTargets({ ...salesActor, role: "developer" }), /Forbidden/);
  await assert.rejects(createSalesTarget({ ...adminActor, role: "partner" }, base), /Forbidden/);
  console.log("PASS: monthly/yearly revenue and deal targets; admin sees all; sales sees own only; only admin can assign or edit");

  await assert.rejects(createSalesTarget(adminActor, base), /already exists/);
  await assert.rejects(createSalesTarget(adminActor, { ...base, assignedUserId: String(inactive._id) }), /active salesperson/);
  await assert.rejects(createSalesTarget(adminActor, { ...base, assignedUserId: String(admin._id) }), /active salesperson/);
  for (const changes of [{ periodKey: "2026-13" }, { period: "yearly", periodKey: "2026-09" }, { target: -1 }, { achieved: -2 }, { metric: "deals", target: 2.5 }, { target: 10.123 }]) {
    assert.equal(createSalesTargetSchema.safeParse({ ...base, ...changes }).success, false);
  }
  const updated = await updateSalesTarget(adminActor, String(monthly._id), { ...base, target: 150000, achieved: 75000, version: 0 });
  assert.equal(updated.target, 150000); assert.equal(updated.achieved, 75000); assert.equal(updated.version, 1);
  await assert.rejects(updateSalesTarget(adminActor, String(monthly._id), { ...base, version: 0 }), /changed/);
  await assert.rejects(updateSalesTarget(adminActor, String(yearly._id), { ...base, version: 0 }), /already exists/);
  console.log("PASS: duplicate assignments, invalid periods/amounts, inactive recipients, stale edits and update collisions rejected");

  const raced = await Promise.allSettled([1, 2].map(() => createSalesTarget(adminActor, { ...base, periodKey: "2026-10" })));
  assert.equal(raced.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(await SalesTargetModel.countDocuments({ assignedUserId: a._id, periodKey: "2026-10" }), 1);
  console.log("PASS: concurrent duplicate requests create exactly one target");
}
main().finally(() => mongoose.disconnect()).catch((error) => { console.error(error); process.exitCode = 1; });

import assert from "node:assert/strict";
import mongoose from "mongoose";
import { LeadModel, UserModel } from "@/models";
import { changeLeadStatus } from "@/lib/leads/close-deal";
import { createSalesTarget, listSalesTargets } from "@/lib/sales-targets/service";
import { closedDealProgress } from "@/lib/sales-targets/progress";
import type { SalesTargetsData } from "@/components/sales-targets/sales-targets-workspace";
import { createLeadSchema } from "@/lib/validation/lead";

const uri = process.env.SALES_TARGET_TEST_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27943\/hrms_sales_targets_test_[a-z0-9]+$/.test(uri)) throw new Error("Use an isolated sales-target test database on port 27943");
async function main() {
  await mongoose.connect(uri!);
  const [a, b, admin] = await UserModel.create([
    { fullName: "Sales A", email: "a@test.invalid", role: "sales", status: "active" },
    { fullName: "Sales B", email: "b@test.invalid", role: "sales", status: "active" },
    { fullName: "Admin Test", email: "admin@test.invalid", role: "admin", status: "active" },
  ]);
  const actor = { userId: String(a._id), role: "sales" as const };
  const adminActor = { userId: String(admin._id), role: "admin" as const };
  const lead = await LeadModel.create({ title: "Revenue test", source: "cold_outreach", ownerId: a._id });
  await assert.rejects(changeLeadStatus(actor, String(lead._id), { status: "closed_won" }), /Enter revenue/);
  await assert.rejects(changeLeadStatus(actor, String(lead._id), { status: "closed_won", revenue: -1 }));
  await assert.rejects(changeLeadStatus(actor, String(lead._id), { status: "closed_won", revenue: 123.456 }));
  // Closing a sales deal must work without scope or proposal documents.
  await assert.rejects(changeLeadStatus({ ...actor, userId: String(b._id) }, String(lead._id), { status: "closed_won", revenue: 5000 }), /not found/);
  await changeLeadStatus(actor, String(lead._id), { status: "closed_won", revenue: 5000.25 });
  await changeLeadStatus(actor, String(lead._id), { status: "closed_won", revenue: 99999 });
  const closed = await LeadModel.findById(lead._id);
  assert.equal(closed.closure.revenuePaise, 500025);
  const month = new Date(closed.closure.closedAt.getTime() + 330 * 60_000).toISOString().slice(0, 7);
  for (const period of ["monthly", "yearly"] as const) for (const metric of ["revenue", "deals"] as const) {
    await createSalesTarget(adminActor, { assignedUserId: String(a._id), period, periodKey: period === "monthly" ? month : month.slice(0, 4), metric, target: metric === "revenue" ? 10000 : 5, achieved: 0 });
  }
  const data = await listSalesTargets(actor) as SalesTargetsData;
  assert.equal(data.targets.length, 4);
  for (const target of data.targets) assert.equal(target.achieved, target.metric === "revenue" ? 5000.25 : 1);
  await LeadModel.updateOne({ _id: lead._id }, { $set: { ownerId: b._id } });
  const progress = await closedDealProgress([String(a._id), String(b._id)]);
  assert.equal(progress.get(`${a._id}:${month}`)?.deals, 1);
  assert.equal(progress.get(`${b._id}:${month}`), undefined);
  await changeLeadStatus(adminActor, String(lead._id), { status: "negotiation" });
  assert.equal((await closedDealProgress([String(a._id)])).size, 0);
  await changeLeadStatus({ ...actor, userId: String(b._id) }, String(lead._id), { status: "closed_won", revenue: 6000 });
  assert.equal((await closedDealProgress([String(b._id)])).get(`${b._id}:${month}`)?.revenue, 6000);
  assert.equal(createLeadSchema.safeParse({ title: "Bypass test", source: "cold_outreach", status: "closed_won" }).success, false);
  // India month boundary: UTC Jan 31 19:00 is February locally.
  await LeadModel.updateOne({ _id: lead._id }, { $set: { "closure.closedAt": new Date("2026-01-31T19:00:00Z") } });
  const boundary = await closedDealProgress([String(b._id)]);
  assert.equal(boundary.get(`${b._id}:2026-02`)?.revenue, 6000);
  assert.equal(boundary.get(`${b._id}:2026`)?.deals, 1);
  assert.equal(boundary.has(`${b._id}:2026-01`), false);
  console.log("PASS: required valid revenue, closure without scope/proposal documents, ownership checks, retry dedupe, monthly/yearly targets, transfer attribution, reopen/reclose, India period boundaries, creation bypass rejected");
}
main().finally(() => mongoose.disconnect()).catch((error) => { console.error(error); process.exitCode = 1; });

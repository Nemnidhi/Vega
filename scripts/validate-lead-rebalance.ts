import assert from "node:assert/strict";
import mongoose from "mongoose";
import { LeadModel, UserModel } from "@/models";
import { assertSalesLeadAccess, leadVisibilityFilter, relatedLeadFilter } from "@/lib/leads/access";
import { getLeadRebalancePlan, rebalanceLeads, planLeadRebalance } from "@/lib/leads/rebalance";
import { changeLeadOwner } from "@/lib/leads/transfer";

const uri = process.env.LEAD_ASSIGNMENT_TEST_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27943\/hrms_assignment_test_[a-z0-9]+$/.test(uri)) throw new Error("Use a fresh isolated hrms_assignment_test_ database on 127.0.0.1:27943");
async function main() {
  await mongoose.connect(uri!);
  const [a, b, admin] = await UserModel.create([
    { fullName: "Sales A", email: "a@test.invalid", role: "sales", status: "active" },
    { fullName: "Sales B", email: "b@test.invalid", role: "sales", status: "active" },
    { fullName: "Admin Test", email: "admin@test.invalid", role: "admin", status: "active" },
  ]);
  const actorA = { userId: String(a._id), role: "sales" as const };
  const actorB = { userId: String(b._id), role: "sales" as const };
  const actorAdmin = { userId: String(admin._id), role: "admin" as const };
  const leads = await LeadModel.insertMany(Array.from({ length: 100 }, (_, index) => ({ title: `Rebalance lead ${index}`, source: "cold_outreach", ownerId: a._id })));
  const closed = await LeadModel.create({ title: "Closed lead", source: "cold_outreach", status: "closed_lost", ownerId: a._id });
  await assertSalesLeadAccess(actorA, String(leads[0]._id));
  await assert.rejects(assertSalesLeadAccess(actorB, String(leads[0]._id)), /not found/);
  assert.equal(await LeadModel.countDocuments(leadVisibilityFilter(actorB)), 0);
  assert.deepEqual((await relatedLeadFilter(actorB)).leadId?.$in, []);
  await assert.rejects(changeLeadOwner(String(leads[0]._id), { ownerId: String(b._id), expectedOwnerId: String(a._id) }, actorB), /not found/);
  await assert.rejects(getLeadRebalancePlan(actorA), /Forbidden/);
  await assert.rejects(rebalanceLeads(actorA, ""), /Forbidden/);
  console.log("PASS: sales only access owned leads; cannot claim or transfer another owner's lead; rebalance is admin-only");
  const plan = await getLeadRebalancePlan(actorAdmin);
  assert.equal(plan.total, 100);
  assert.deepEqual(plan.team.map((member) => member.after), [50, 50]);
  assert.equal(plan.moves.length, 50);
  const result = await rebalanceLeads(actorAdmin, plan.token);
  assert.equal(result.moved, 50); assert.equal(result.skipped, 0);
  assert.equal(await LeadModel.countDocuments({ status: "new", ownerId: a._id }), 50);
  assert.equal(await LeadModel.countDocuments({ status: "new", ownerId: b._id }), 50);
  assert.equal(String((await LeadModel.findById(closed._id)).ownerId), String(a._id));
  assert.equal(await LeadModel.countDocuments({ "assignmentHistory.method": "rebalance" }), 50);
  assert.equal((await getLeadRebalancePlan(actorAdmin)).moves.length, 0);
  await assert.rejects(rebalanceLeads(actorAdmin, plan.token), /changed/);
  console.log("PASS: 100 leads become 50/50 with only 50 moves; closed lead preserved; audit history recorded; repeat preview is no-op; stale preview rejected");
  const assigned = await LeadModel.findOne({ ownerId: b._id, status: "new" });
  await changeLeadOwner(String(assigned._id), { ownerId: String(a._id), expectedOwnerId: String(b._id) }, actorB);
  await assert.rejects(assertSalesLeadAccess(actorB, String(assigned._id)), /not found/);
  await assertSalesLeadAccess(actorA, String(assigned._id));
  console.log("PASS: transfer removes old owner's access and gives recipient access");
  const odd = planLeadRebalance(Array.from({ length: 101 }, (_, index) => ({ id: String(index), ownerId: null, status: "new", updatedAt: "" })), [{ id: "a", fullName: "A" }, { id: "b", fullName: "B" }]);
  assert.deepEqual(odd.team.map((member) => member.after), [51, 50]);
  await UserModel.updateMany({ role: "sales" }, { $set: { status: "inactive" } });
  const empty = await getLeadRebalancePlan(actorAdmin);
  await assert.rejects(rebalanceLeads(actorAdmin, empty.token), /No active/);
  console.log("PASS: odd totals differ by at most one; no active team cannot trigger redistribution");
}
main().finally(() => mongoose.disconnect()).catch((error) => { console.error(error); process.exitCode = 1; });

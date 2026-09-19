import assert from "node:assert/strict";
import mongoose from "mongoose";
import { LeadModel, UserModel } from "@/models";
import { LeadAssignmentCursorModel } from "@/models/LeadAssignmentCursor";
import { allocateLeadOwners } from "@/lib/leads/assignment";
import { changeLeadOwner } from "@/lib/leads/transfer";

// Deliberately isolated: never uses the application's .env or production URI.
const uri = process.env.LEAD_ASSIGNMENT_TEST_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27943\/hrms_assignment_test_[a-z0-9]+$/.test(uri)) {
  throw new Error("Set LEAD_ASSIGNMENT_TEST_URI to mongodb://127.0.0.1:27943/hrms_assignment_test_<unique suffix> on a disposable mongod.");
}

async function main() {
  await mongoose.connect(uri!);
  const sales: Array<{ _id: mongoose.Types.ObjectId }> = await UserModel.create([0, 1, 2].map((index) => ({ fullName: `Sales ${index}`, email: `sales${index}@test.invalid`, role: "sales", status: "active" })));
  const admin = await UserModel.create({ fullName: "Test Admin", email: "admin@test.invalid", role: "admin", status: "active" });
  await UserModel.create({ fullName: "Inactive Sales", email: "inactive@test.invalid", role: "sales", status: "inactive" });
  await UserModel.create({ fullName: "Invited Sales", email: "invited@test.invalid", role: "sales", status: "invited" });
  await LeadModel.init();
  const input = { title: "Test lead", source: "cold_outreach" };
  const leads = await Promise.all(Array.from({ length: 30 }, () => LeadModel.create(input)));
  for (const user of sales) assert.equal(leads.filter((lead) => String(lead.ownerId) === String(user._id)).length, 10);
  assert.ok(leads.every((lead) => lead.assignmentHistory[0].method === "round_robin"));
  console.log("PASS: 30 concurrent leads distribute 10 each; inactive/invited/non-sales excluded; history persisted");

  const ranges = await Promise.all([allocateLeadOwners(4), allocateLeadOwners(5)]);
  for (const user of sales) assert.equal(ranges.flat().filter((id) => id === String(user._id)).length, 3);
  console.log("PASS: concurrent import ranges continue the shared rotation");

  const lead = leads[0];
  const previousOwner = String(lead.ownerId);
  const recipient = sales.find((user) => String(user._id) !== previousOwner)!;
  const actor = { userId: String(admin._id), role: "admin" as const };
  const before = await LeadAssignmentCursorModel.findById("sales").lean();
  await changeLeadOwner(String(lead._id), { ownerId: String(recipient._id), expectedOwnerId: previousOwner }, actor);
  await assert.rejects(changeLeadOwner(String(lead._id), { ownerId: previousOwner, expectedOwnerId: previousOwner }, actor));
  const other = sales.find((user) => String(user._id) !== String(recipient._id) && String(user._id) !== previousOwner)!;
  await assert.rejects(changeLeadOwner(String(lead._id), { ownerId: String(other._id), expectedOwnerId: previousOwner }, actor), /Assignment changed/);
  await assert.rejects(changeLeadOwner(String(lead._id), { ownerId: String(admin._id), expectedOwnerId: String(recipient._id) }, actor), /active salesperson/);
  await assert.rejects(changeLeadOwner(String(lead._id), { ownerId: String(other._id), expectedOwnerId: String(recipient._id) }, { ...actor, role: "digital_marketing" }), /Forbidden/);
  await changeLeadOwner(String(lead._id), { ownerId: String(other._id), expectedOwnerId: String(recipient._id) }, { userId: String(recipient._id), role: "sales" });
  const updated = await LeadModel.findById(lead._id);
  assert.equal(updated.assignmentHistory.at(-1).method, "transfer");
  assert.equal(updated.assignmentHistory.at(-2).method, "manual");
  assert.equal((await LeadAssignmentCursorModel.findById("sales").lean())?.sequence, before?.sequence);
  console.log("PASS: admin assignment, sales transfer, role restrictions, invalid recipient, stale-write rejection, manual changes preserve rotation");

  await UserModel.updateMany({ role: "sales" }, { $set: { status: "inactive" } });
  const unassigned = await LeadModel.create(input);
  assert.equal(unassigned.ownerId, null);
  await UserModel.updateOne({ _id: sales[0]._id }, { $set: { status: "active" } });
  unassigned.title = "Existing lead edited";
  await unassigned.save();
  assert.equal(unassigned.ownerId, null);
  assert.equal(String((await LeadModel.create(input)).ownerId), String(sales[0]._id));
  console.log("PASS: no-sales fallback retains lead; ordinary edits do not redistribute; active team changes respected");
}

main().finally(async () => { await mongoose.disconnect(); }).catch((error) => { console.error(error); process.exitCode = 1; });

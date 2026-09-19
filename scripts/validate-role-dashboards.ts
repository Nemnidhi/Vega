/**
 * Every role now has its own dashboard, and each is a different set of queries
 * against loosely-typed models - so a wrong field name compiles cleanly and only
 * shows up as an empty panel in production. This runs each one against seeded
 * data and checks the figures are the ones that data implies.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";

const uri = process.env.DASH_TEST_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27017\/hrms_dash_test_[a-z0-9]+$/.test(uri)) {
  throw new Error("Use an isolated test database: hrms_dash_test_<suffix> on 127.0.0.1:27017");
}

process.env.MONGODB_URI = uri;
process.env.MONGODB_DB_NAME = uri.split("/").pop()!;
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? crypto.randomBytes(32).toString("hex");

function monthKeyNow() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function dateKeyNow() {
  const now = new Date();
  return `${monthKeyNow()}-${String(now.getDate()).padStart(2, "0")}`;
}

async function main() {
  const { getRoleDashboard, getDeveloperDashboard, usesBusinessOverview } = await import("@/lib/dashboard/role-home");
  const { UserModel, LeadModel, LeadFollowUpModel, TaskModel, MeetingModel, AttendanceModel, SalesTargetModel } =
    await import("@/models");

  await mongoose.connect(uri!);

  const rep = await UserModel.create({ fullName: "A Rep", email: "rep@test.invalid", role: "sales", status: "active" });
  const dev = await UserModel.create({ fullName: "A Dev", email: "dev@test.invalid", role: "developer", status: "active" });
  const pm = await UserModel.create({ fullName: "A PM", email: "pm@test.invalid", role: "project_manager", status: "active" });
  const marketer = await UserModel.create({ fullName: "A Marketer", email: "mk@test.invalid", role: "digital_marketing", status: "active" });

  const monthKey = monthKeyNow();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const laterToday = new Date();
  laterToday.setHours(23, 0, 0, 0);

  // --- Admin and partner keep the business overview; nobody else does.
  assert.equal(usesBusinessOverview("admin"), true);
  assert.equal(usesBusinessOverview("partner"), true);
  for (const role of ["sales", "developer", "project_manager", "digital_marketing"] as const) {
    assert.equal(usesBusinessOverview(role), false, `${role} should get its own dashboard`);
  }

  // ---------------------------------------------------------------- sales
  const openLead = await LeadModel.create({ title: "Acme Corp", source: "cold_outreach", ownerId: rep._id });
  await LeadModel.create({ title: "Lost Co", source: "cold_outreach", ownerId: rep._id, status: "closed_lost" });
  await LeadModel.create({
    title: "Won Co", source: "cold_outreach", ownerId: rep._id, status: "closed_won",
    closure: { revenuePaise: 5000000, salespersonId: rep._id, closedAt: new Date(), recordedBy: rep._id },
  });
  await LeadFollowUpModel.create({
    leadId: openLead._id, status: "scheduled", dueAt: yesterday,
    nextAction: "Call about pricing", assignedToUserId: rep._id, createdById: rep._id,
  });
  await SalesTargetModel.create({
    assignedUserId: rep._id, metric: "revenue", period: "monthly", periodKey: monthKey,
    target: 100000, createdBy: rep._id, updatedBy: rep._id,
  });
  await MeetingModel.create({
    type: "online", startAt: new Date(Date.now() + 86400000), durationMinutes: 30,
    contactName: "Acme Buyer", location: "Online", assignedToUserId: rep._id,
  });

  const sales = await getRoleDashboard("sales", String(rep._id));
  const metric = (data: { metrics: Array<{ key: string; value: string }> }, key: string) =>
    data.metrics.find((item) => item.key === key)?.value;

  assert.equal(metric(sales, "open"), "1", "only the live lead counts as open");
  assert.equal(metric(sales, "won"), "1", "the closed-won lead counts this month");
  assert.match(String(metric(sales, "revenue")), /50,000/, "revenue comes from closure paise");
  assert.equal(metric(sales, "followups"), "1");

  assert.equal(sales.progress.length, 1, "the monthly revenue target should appear");
  assert.equal(sales.progress[0].achieved, 50000);
  assert.equal(sales.progress[0].target, 100000);

  const followUpList = sales.lists.find((list) => list.title === "Follow-ups due");
  assert.equal(followUpList?.items.length, 1);
  assert.equal(followUpList?.items[0].title, "Acme Corp", "the lead name, not the follow-up id");
  const meetingList = sales.lists.find((list) => list.title === "Upcoming meetings");
  assert.equal(meetingList?.items.length, 1, "a meeting assigned to the rep should show");
  assert.equal(meetingList?.items[0].title, "Acme Buyer");

  // ---------------------------------------------------------------- developer
  const parent = await TaskModel.create({ title: "Parent", createdBy: dev._id, assignedToUserId: dev._id, status: "IN_PROGRESS" });
  await TaskModel.create({ title: "Late one", createdBy: dev._id, assignedToUserId: dev._id, status: "IN_PROGRESS", dueAt: yesterday });
  await TaskModel.create({ title: "Due today", createdBy: dev._id, assignedToUserId: dev._id, status: "NOT_STARTED", dueAt: laterToday });
  await TaskModel.create({ title: "Finished", createdBy: dev._id, assignedToUserId: dev._id, status: "COMPLETED", dueAt: yesterday });
  await TaskModel.create({ title: "Someone else's", createdBy: dev._id, assignedToUserId: pm._id, status: "IN_PROGRESS" });
  await AttendanceModel.create({ userId: dev._id, dateKey: dateKeyNow(), dayStatus: "present", workedMinutes: 480 });

  const developer = await getRoleDashboard("developer", String(dev._id));
  assert.equal(metric(developer, "open"), "3", "completed is not open, and another person's task is not theirs");
  assert.equal(metric(developer, "overdue"), "1", "a completed task past its date is not overdue");
  assert.equal(metric(developer, "today"), "1");
  assert.equal(metric(developer, "worked"), "8h 00m", "worked time reads from attendance");

  // A subtask has no page of its own, so its row must point at the parent.
  const child = await TaskModel.create({
    title: "Child", createdBy: dev._id, assignedToUserId: dev._id,
    status: "IN_PROGRESS", parentTaskId: parent._id, dueAt: yesterday,
  });
  const withChild = await getRoleDashboard("developer", String(dev._id));
  const overdueList = withChild.lists.find((list) => list.title === "Overdue");
  const childRow = overdueList?.items.find((item) => item.title === "Child");
  assert.ok(childRow, "the subtask should be listed");
  assert.equal(childRow.href, `/tasks/${parent._id}`, "a subtask links to its parent, not to a 404");
  await TaskModel.deleteOne({ _id: child._id });

  // ---------------------------------------------------------------- project manager
  const manager = await getRoleDashboard("project_manager", String(pm._id));
  assert.equal(metric(manager, "mine"), "1", "the PM sees their own queue too");
  assert.ok(Number(metric(manager, "open")) >= 4, "open counts the whole team, not just theirs");
  assert.equal(metric(manager, "overdue"), "1", "team overdue excludes the completed one");

  // ---------------------------------------------------------------- marketing
  const marketing = await getRoleDashboard("digital_marketing", String(marketer._id));
  assert.equal(metric(marketing, "new"), "3", "all three leads were created this month");
  assert.equal(metric(marketing, "top"), "cold outreach", "the source label is humanised");
  assert.equal(metric(marketing, "untouched"), "1", "only Acme is still at status new; the others are closed");

  // --- Leads auto-assign an owner on create, so "unassigned" would always be
  //     zero. What marketing can act on is a lead nobody has contacted, which
  //     means one still sitting at status "new".
  await LeadModel.create({ title: "Fresh", source: "cold_outreach" });
  const afterFresh = await getRoleDashboard("digital_marketing", String(marketer._id));
  assert.equal(metric(afterFresh, "untouched"), "2", "a brand new lead is awaiting contact");

  // --- Every dashboard must be renderable: no missing labels or values.
  for (const [role, dash] of [
    ["sales", sales],
    ["developer", developer],
    ["project_manager", manager],
    ["digital_marketing", marketing],
  ] as const) {
    assert.ok(dash.headline, `${role} needs a headline`);
    assert.ok(dash.metrics.length > 0, `${role} needs metrics`);
    for (const item of dash.metrics) {
      assert.ok(item.label && item.value !== undefined, `${role} metric ${item.key} is incomplete`);
    }
    for (const list of dash.lists) {
      assert.ok(list.title && list.href && list.emptyText, `${role} list ${list.title} is incomplete`);
    }
  }

  // ------------------------------------------- developer, the fuller version
  const rich = await getDeveloperDashboard(String(dev._id), "Abhishek");
  assert.equal(rich.greetingName, "Abhishek");
  assert.ok(rich.quote.text, "a line of encouragement is shown");

  for (const item of rich.metrics) {
    assert.equal(item.series.length, 7, `${item.key} needs seven days of history`);
    assert.ok(item.series.every((value) => Number.isFinite(value) && value >= 0), `${item.key} history must be real numbers`);
  }

  // Nothing records a daily snapshot, so the series is rebuilt from createdAt,
  // dueAt and completedAt. Check it actually reflects the data rather than
  // repeating today's figure seven times.
  const openMetric = rich.metrics.find((item) => item.key === "open")!;
  assert.equal(
    openMetric.series[openMetric.series.length - 1],
    Number(openMetric.value),
    "the last point of the series must equal today's figure",
  );

  const overdueMetric = rich.metrics.find((item) => item.key === "overdue")!;
  assert.equal(overdueMetric.series[overdueMetric.series.length - 1], 1, "one task is overdue today");
  assert.equal(
    overdueMetric.series[0],
    0,
    "it was not yet overdue seven days ago - a flat series would mean the history is fake",
  );

  // A task completed long ago must not count as open today.
  const longDone = await TaskModel.create({
    title: "Ancient", createdBy: dev._id, assignedToUserId: dev._id,
    status: "COMPLETED", completedAt: new Date(Date.now() - 10 * 86400000),
  });
  const afterAncient = await getDeveloperDashboard(String(dev._id), "Abhishek");
  const openAfter = afterAncient.metrics.find((item) => item.key === "open")!;
  assert.equal(openAfter.series[openAfter.series.length - 1], Number(openMetric.value),
    "a task completed before the window does not change today's open count");
  await TaskModel.deleteOne({ _id: longDone._id });

  // --- Weekly output.
  assert.equal(rich.productivity.perDay.length, 7);
  assert.equal(rich.productivity.workedMinutes, 480, "work time comes from attendance");
  // Three of this developer's tasks fall due inside the window and none were
  // completed in it, so the rate is a genuine zero.
  assert.equal(rich.productivity.ratePercent, 0);

  // With nothing due at all the rate is unknown rather than zero - 0% against no
  // work would read as a failure.
  const idle = await UserModel.create({
    fullName: "Idle Dev", email: "idle@test.invalid", role: "developer", status: "active",
  });
  const idleDash = await getDeveloperDashboard(String(idle._id), "Idle");
  assert.equal(idleDash.productivity.ratePercent, null);
  assert.equal(idleDash.productivity.completed, 0);
  assert.equal(idleDash.schedule.length, 0);
  for (const item of idleDash.metrics) {
    assert.equal(item.series.length, 7, "an empty dashboard still needs a drawable series");
  }

  // --- Today's schedule shows only today's meetings, and only this person's.
  await MeetingModel.create({
    type: "in_person", startAt: new Date(new Date().setHours(11, 0, 0, 0)), durationMinutes: 45,
    contactName: "Standup", location: "Office", assignedToUserId: dev._id,
  });
  await MeetingModel.create({
    type: "online", startAt: new Date(Date.now() + 5 * 86400000), durationMinutes: 30,
    contactName: "Next week", location: "Online", assignedToUserId: dev._id,
  });
  const scheduled = await getDeveloperDashboard(String(dev._id), "Abhishek");
  assert.equal(scheduled.schedule.length, 1, "only today's meeting belongs on today's schedule");
  assert.equal(scheduled.schedule[0].title, "Standup");

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log("role dashboard checks passed");
}

main().catch(async (error) => {
  console.error(error);
  try { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } catch {}
  process.exit(1);
});

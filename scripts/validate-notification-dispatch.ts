import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import mongoose from "mongoose";

const certDir = process.env.PUSH_TEST_CERT_DIR;
if (!certDir) throw new Error("Set PUSH_TEST_CERT_DIR to a directory holding key.pem and cert.pem");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const uri = process.env.PUSH_TEST_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27017\/hrms_push_test_[a-z0-9]+$/.test(uri)) {
  throw new Error("Use an isolated test database: hrms_push_test_<suffix> on 127.0.0.1:27017");
}

function fakePushService() {
  const received: Array<{ headers: http.IncomingHttpHeaders; body: Buffer }> = [];
  const server = https.createServer(
    { key: fs.readFileSync(`${certDir}/key.pem`), cert: fs.readFileSync(`${certDir}/cert.pem`) },
    (req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => { received.push({ headers: req.headers, body: Buffer.concat(chunks) }); res.writeHead(201).end(); });
    },
  );
  return {
    received,
    listen: () => new Promise<number>((r) => server.listen(0, "127.0.0.1", () => r((server.address() as { port: number }).port))),
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

function browserKeys() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") };
}

/** Wait for the fire-and-forget push to land, without a blind sleep. */
async function settled(service: { received: unknown[] }, expected: number, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (service.received.length < expected && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return service.received.length;
}

async function main() {
  const service = fakePushService();
  const port = await service.listen();

  // notifyUser calls connectToDatabase, which validates the server env before it
  // notices mongoose is already connected. Point it at the same throwaway
  // database this test uses so nothing can reach a real one.
  process.env.MONGODB_URI = uri!;
  process.env.MONGODB_DB_NAME = new URL(uri!.replace("mongodb://", "http://")).pathname.slice(1);
  process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? crypto.randomBytes(32).toString("hex");

  const keys = (await import("web-push")).default.generateVAPIDKeys();
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_CONTACT_EMAIL = "test@test.invalid";

  const { notifyUser } = await import("@/lib/notifications/dispatch");
  const { PushSubscriptionModel, NotificationModel } = await import("@/models");

  await mongoose.connect(uri!);

  const recipient = new mongoose.Types.ObjectId();
  const actor = new mongoose.Types.ObjectId();
  const lead = new mongoose.Types.ObjectId();
  await PushSubscriptionModel.create({
    userId: recipient, endpoint: `https://127.0.0.1:${port}/d1`, ...browserKeys(),
  });

  const base = {
    actorId: String(actor),
    type: "lead_assigned" as const,
    title: "Lead assigned to you",
    body: "Acme Corp",
    entityType: "lead" as const,
    entityId: String(lead),
    url: `/leads/${lead}`,
    dedupeKey: `lead_assigned:${lead}:none:${recipient}`,
  };

  // --- First raise: writes the bell row and pushes.
  const first = await notifyUser({ ...base, recipientUserId: String(recipient) });
  assert.equal(first.created, true);
  assert.equal(await settled(service, 1), 1, "should have pushed once");

  const row = await NotificationModel.findOne({ recipientUserId: recipient }).lean();
  assert.ok(row, "in-app row should exist");
  assert.equal(row.entityType, "lead");
  assert.equal(row.url, `/leads/${lead}`, "url must be stored so the bell and the push agree");
  assert.deepEqual([...row.channels].sort(), ["in_app", "push"]);

  // --- Re-raising the same thing must not buzz the phone a second time.
  const second = await notifyUser({ ...base, recipientUserId: String(recipient) });
  assert.equal(second.created, false, "duplicate should not create a second row");
  assert.equal(await settled(service, 2, 1200), 1, "a deduped notification must not push again");
  assert.equal(await NotificationModel.countDocuments({ recipientUserId: recipient }), 1);

  // --- Nobody is told about their own action.
  const selfInflicted = await notifyUser({
    ...base,
    recipientUserId: String(actor),
    actorId: String(actor),
    dedupeKey: `self:${lead}`,
  });
  assert.equal(selfInflicted.created, false, "acting on your own lead must not notify you");
  assert.equal(await NotificationModel.countDocuments({ recipientUserId: actor }), 0);

  // --- A genuinely different event for the same lead still gets through.
  const moved = await notifyUser({
    ...base,
    recipientUserId: String(recipient),
    type: "lead_transferred",
    title: "Lead moved off your list",
    dedupeKey: `lead_moved_away:${lead}:${recipient}:someone-else`,
  });
  assert.equal(moved.created, true, "a different hand-off is a new notification");
  assert.equal(await settled(service, 2), 2);

  // --- A recipient with no devices still gets the bell row; push is just skipped.
  const deviceless = new mongoose.Types.ObjectId();
  const quiet = await notifyUser({
    ...base, recipientUserId: String(deviceless), dedupeKey: `quiet:${lead}`,
  });
  assert.equal(quiet.created, true);
  assert.equal(await NotificationModel.countDocuments({ recipientUserId: deviceless }), 1);
  assert.equal(await settled(service, 3, 1200), 2, "no devices means no push, but the row stands");

  // --- Payload actually carries the click-through target.
  for (const request of service.received) {
    assert.equal(request.headers["content-encoding"], "aes128gcm");
  }

  // ---------------------------------------------------------------- sweeps
  const { sweepOverdueTasks } = await import("@/lib/notifications/tasks");
  const { sweepOverdueFollowUps } = await import("@/lib/notifications/follow-ups");
  const { getAssignableUsers } = await import("@/lib/tasks/queries");
  const { TaskModel, LeadFollowUpModel, LeadModel, UserModel } = await import("@/models");

  const dev = await UserModel.create({ fullName: "Dev Person", email: "dev@test.invalid", role: "developer", status: "active" });
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // --- An overdue top-level task notifies its assignee. The old sweep only ever
  //     looked at subtasks, so these went unnoticed entirely.
  await TaskModel.create({
    title: "Ship the thing", status: "IN_PROGRESS", dueAt: yesterday,
    assignedToUserId: dev._id, createdBy: dev._id, parentTaskId: null,
  });
  assert.equal(await sweepOverdueTasks(), 1, "one overdue task should be found");
  assert.equal(
    await NotificationModel.countDocuments({ recipientUserId: dev._id, type: "subtask_overdue" }),
    1,
    "the assignee should have been told",
  );

  // --- Re-running the same day must not pile up duplicates.
  await sweepOverdueTasks();
  assert.equal(
    await NotificationModel.countDocuments({ recipientUserId: dev._id, type: "subtask_overdue" }),
    1,
    "a second sweep on the same day must not re-notify",
  );

  // --- A completed task is not overdue, however old its due date.
  await TaskModel.create({
    title: "Already done", status: "COMPLETED", dueAt: yesterday,
    assignedToUserId: dev._id, createdBy: dev._id, parentTaskId: null,
  });
  assert.equal(await sweepOverdueTasks(), 1, "completed tasks must not be reported overdue");

  // --- An overdue follow-up reminds the rep who owns it.
  const followLead = await LeadModel.create({ title: "Acme Corp", source: "cold_outreach", ownerId: dev._id });
  await LeadFollowUpModel.create({
    leadId: followLead._id, status: "scheduled", dueAt: yesterday,
    nextAction: "Call back about pricing", assignedToUserId: dev._id, createdById: dev._id,
  });
  assert.equal(await sweepOverdueFollowUps(), 1);
  const followRow = await NotificationModel.findOne({
    recipientUserId: dev._id, type: "due_date_approaching",
  }).lean();
  assert.ok(followRow, "follow-up reminder should exist");
  assert.match(String(followRow.title), /Follow-up overdue/);
  assert.equal(followRow.url, `/leads/${followLead._id}`, "should link to the lead");

  // --- A completed follow-up is not chased.
  await LeadFollowUpModel.updateMany({}, { $set: { status: "completed" } });
  assert.equal(await sweepOverdueFollowUps(), 0, "closed follow-ups must not be chased");

  // --- Clients must never appear in the staff assignee list. This is what put
  //     the same person in the dropdown three times over.
  await UserModel.create([
    { fullName: "Dup Person", email: "staff@test.invalid", role: "sales", status: "active" },
    { fullName: "Dup Person", email: "portal@test.invalid", role: "client", status: "active" },
  ]);
  const assignable = await getAssignableUsers("admin");
  const roles = new Set(assignable.map((user: { role: string }) => user.role));
  assert.ok(!roles.has("client"), "clients must not be assignable to internal tasks");
  assert.equal(
    assignable.filter((user: { fullName: string }) => user.fullName === "Dup Person").length,
    1,
    "the staff account only - the client duplicate must be gone",
  );

  // --- The task detail page 404'd for every non-manager, including on their own
  //     tasks: it loads the task with .populate(), and the access check compared
  //     String(populatedUser) - "[object Object]" - against a user id.
  const { getTaskDetailForUser } = await import("@/lib/tasks/queries");
  const { canAccessTask, refId } = await import("@/lib/tasks/subtasks");

  const owned = await TaskModel.create({
    title: "Task 1", status: "NOT_STARTED",
    assignedToUserId: dev._id, createdBy: dev._id, parentTaskId: null,
  });

  assert.equal(refId({ _id: dev._id, fullName: "x" }), String(dev._id), "refId must unwrap a populated ref");
  assert.equal(refId(dev._id), String(dev._id), "refId must pass a raw id through");
  assert.equal(refId(null), "", "refId must tolerate an empty ref");

  // Populated exactly as the detail query returns it.
  const populated = await TaskModel.findById(owned._id)
    .populate("assignedToUserId", "fullName email role")
    .lean();
  assert.ok(
    canAccessTask({ userId: String(dev._id), role: "developer" }, populated!),
    "the assignee must pass the access check on a populated document",
  );

  const detail = await getTaskDetailForUser(String(owned._id), String(dev._id), "developer");
  assert.ok(detail, "a developer must be able to open a task assigned to them - this was the 404");

  // Someone unrelated still must not get in.
  const stranger = await UserModel.create({
    fullName: "Nosy Dev", email: "nosy@test.invalid", role: "developer", status: "active",
  });
  assert.equal(
    await getTaskDetailForUser(String(owned._id), String(stranger._id), "developer"),
    null,
    "an unrelated developer must still be refused",
  );

  // --- Moving a task along tells the admins, but not the person who moved it.
  const { notifyTaskStatusChanged } = await import("@/lib/notifications/tasks");
  const admin = await UserModel.create({
    fullName: "Boss", email: "boss@test.invalid", role: "admin", status: "active",
  });
  await NotificationModel.deleteMany({ recipientUserId: admin._id });

  await notifyTaskStatusChanged({
    taskId: String(owned._id), code: "T-1", title: "Task 1",
    from: "NOT_STARTED", to: "IN_PROGRESS", actorId: String(dev._id),
  });
  assert.equal(
    await NotificationModel.countDocuments({ recipientUserId: admin._id }),
    1,
    "admins should be told when a task moves",
  );
  assert.equal(
    await NotificationModel.countDocuments({ recipientUserId: dev._id, type: "workflow_changed" }),
    0,
    "the person who changed it must not be notified about their own action",
  );

  // Toggling to the same status again in the same minute must not spam.
  await notifyTaskStatusChanged({
    taskId: String(owned._id), code: "T-1", title: "Task 1",
    from: "IN_PROGRESS", to: "IN_PROGRESS", actorId: String(dev._id),
  });
  assert.equal(
    await NotificationModel.countDocuments({ recipientUserId: admin._id }),
    1,
    "repeated changes to the same status must collapse",
  );

  // A different status is a real event and does notify.
  await notifyTaskStatusChanged({
    taskId: String(owned._id), code: "T-1", title: "Task 1",
    from: "IN_PROGRESS", to: "COMPLETED", actorId: String(dev._id),
  });
  assert.equal(
    await NotificationModel.countDocuments({ recipientUserId: admin._id }),
    2,
    "a genuine later change should notify again",
  );

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await service.close();
  console.log("notification dispatch checks passed");
}

main().catch(async (error) => {
  console.error(error);
  try { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } catch {}
  process.exit(1);
});

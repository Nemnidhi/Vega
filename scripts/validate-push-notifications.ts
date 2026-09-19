import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import mongoose from "mongoose";

// web-push only ever speaks HTTPS, so the stand-in push service needs TLS. The
// cert is self-signed, hence the relaxed verification for this process only.
const certDir = process.env.PUSH_TEST_CERT_DIR;
if (!certDir) throw new Error("Set PUSH_TEST_CERT_DIR to a directory holding key.pem and cert.pem");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const uri = process.env.PUSH_TEST_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27017\/hrms_push_test_[a-z0-9]+$/.test(uri)) {
  throw new Error("Use an isolated push test database: hrms_push_test_<suffix> on 127.0.0.1:27017");
}

/**
 * Stands in for the browser's push service (FCM). Records what web-push actually
 * POSTs so the test can assert the payload left encrypted, and can be told to
 * answer 410 Gone to exercise stale-subscription pruning.
 */
function fakePushService() {
  const received: Array<{ headers: http.IncomingHttpHeaders; body: Buffer }> = [];
  let status = 201;
  const server = https.createServer(
    {
      key: fs.readFileSync(`${certDir}/key.pem`),
      cert: fs.readFileSync(`${certDir}/cert.pem`),
    },
    (req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      received.push({ headers: req.headers, body: Buffer.concat(chunks) });
      res.writeHead(status).end();
    });
  },
  );
  return {
    received,
    setStatus: (next: number) => { status = next; },
    listen: () =>
      new Promise<number>((resolve) =>
        server.listen(0, "127.0.0.1", () => resolve((server.address() as { port: number }).port)),
      ),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** A real P-256 keypair + auth secret, exactly as a browser subscription carries. */
function browserKeys() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    p256dh: ecdh.getPublicKey().toString("base64url"),
    auth: crypto.randomBytes(16).toString("base64url"),
  };
}

async function main() {
  const service = fakePushService();
  const port = await service.listen();

  // A throwaway keypair generated per run - never the real one. Committing a
  // production VAPID private key would let anyone push to every registered
  // device, and this repo is public.
  const testKeys = (await import("web-push")).default.generateVAPIDKeys();

  // web-push reads VAPID config at import time, so set it before the module loads.
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = testKeys.publicKey;
  process.env.VAPID_PRIVATE_KEY = testKeys.privateKey;
  process.env.VAPID_CONTACT_EMAIL = "test@test.invalid";

  const { sendPushToUser, pushConfigured } = await import("@/lib/push/send");
  const { PushSubscriptionModel } = await import("@/models");

  assert.equal(pushConfigured, true, "VAPID config should be detected");

  await mongoose.connect(uri!);
  const userId = new mongoose.Types.ObjectId();
  const otherUserId = new mongoose.Types.ObjectId();

  // A user signed in on two devices, plus an unrelated user who must not receive it.
  const deviceA = browserKeys();
  const deviceB = browserKeys();
  const stranger = browserKeys();
  await PushSubscriptionModel.create([
    { userId, endpoint: `https://127.0.0.1:${port}/device-a`, ...deviceA },
    { userId, endpoint: `https://127.0.0.1:${port}/device-b`, ...deviceB },
    { userId: otherUserId, endpoint: `https://127.0.0.1:${port}/stranger`, ...stranger },
  ]);

  // --- Both of the user's devices get the push, the stranger's does not.
  const result = await sendPushToUser(String(userId), {
    title: "Abhishek",
    body: "Standup at 10?",
    url: "/chat/abc",
    tag: "chat-abc",
    // Drives the drawer reply box; the service worker only offers it when set.
    replyTo: String(otherUserId),
  });
  assert.deepEqual(result, { sent: 2, failed: 0 });
  assert.equal(service.received.length, 2);

  for (const request of service.received) {
    // Payload must be encrypted in transit - the push service must never be able
    // to read message text.
    assert.equal(request.headers["content-encoding"], "aes128gcm");
    assert.match(String(request.headers.authorization ?? ""), /^vapid /i);
    assert.ok(request.body.length > 0, "body should carry the encrypted payload");
    assert.ok(
      !request.body.toString("utf8").includes("Standup"),
      "message text must not appear in plaintext",
    );
  }

  // --- lastSuccessAt is stamped so dead devices are identifiable later.
  const afterSuccess = await PushSubscriptionModel.find({ userId }).lean();
  for (const row of afterSuccess) assert.ok(row.lastSuccessAt, "lastSuccessAt should be set");

  // --- A push service reporting 410 Gone means the subscription is dead: prune it.
  service.setStatus(410);
  const gone = await sendPushToUser(String(userId), { title: "x", body: "y", url: "/" });
  assert.deepEqual(gone, { sent: 0, failed: 2 });
  assert.equal(
    await PushSubscriptionModel.countDocuments({ userId }),
    0,
    "410 responses should delete the stale subscriptions",
  );
  assert.equal(
    await PushSubscriptionModel.countDocuments({ userId: otherUserId }),
    1,
    "another user's subscription must be untouched",
  );

  // --- A transient 500 must NOT delete the row; the next message should retry.
  service.setStatus(500);
  const transientKeys = browserKeys();
  await PushSubscriptionModel.create({
    userId, endpoint: `https://127.0.0.1:${port}/flaky`, ...transientKeys,
  });
  const flaky = await sendPushToUser(String(userId), { title: "x", body: "y", url: "/" });
  assert.deepEqual(flaky, { sent: 0, failed: 1 });
  assert.equal(
    await PushSubscriptionModel.countDocuments({ userId }),
    1,
    "a 500 is transient - the subscription must survive",
  );

  // --- A user with no devices is a no-op, not an error.
  assert.deepEqual(
    await sendPushToUser(String(new mongoose.Types.ObjectId()), { title: "x", body: "y", url: "/" }),
    { sent: 0, failed: 0 },
  );

  // --- The endpoint is globally unique: a device handed to another employee
  //     re-registers to the new owner instead of pushing to both.
  const shared = browserKeys();
  await PushSubscriptionModel.findOneAndUpdate(
    { endpoint: `https://127.0.0.1:${port}/shared` },
    { $set: { userId, endpoint: `https://127.0.0.1:${port}/shared`, ...shared } },
    { upsert: true, new: true },
  );
  await PushSubscriptionModel.findOneAndUpdate(
    { endpoint: `https://127.0.0.1:${port}/shared` },
    { $set: { userId: otherUserId, endpoint: `https://127.0.0.1:${port}/shared`, ...shared } },
    { upsert: true, new: true },
  );
  assert.equal(
    await PushSubscriptionModel.countDocuments({ endpoint: `https://127.0.0.1:${port}/shared` }),
    1,
    "re-registering a device must not create a second row",
  );

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await service.close();
  console.log("push notification checks passed");
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

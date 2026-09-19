/**
 * One sign-in form for everyone, so the endpoint has to be right about who may
 * get in and where they land - without the caller telling it what role to expect.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";

const uri = process.env.LOGIN_TEST_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27017\/hrms_login_test_[a-z0-9]+$/.test(uri)) {
  throw new Error("Use an isolated test database: hrms_login_test_<suffix> on 127.0.0.1:27017");
}

process.env.MONGODB_URI = uri;
process.env.MONGODB_DB_NAME = uri.split("/").pop()!;
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? crypto.randomBytes(32).toString("hex");

function post(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify(body),
  });
}

async function main() {
  const { POST } = await import("@/app/api/auth/login/route");
  const { hashPassword } = await import("@/lib/auth/password");
  const { getHomeRouteForRole } = await import("@/lib/auth/constants");
  const { UserModel } = await import("@/models");

  await mongoose.connect(uri!);

  const password = "correct-horse-battery";
  const hash = hashPassword(password);
  await UserModel.create([
    { fullName: "An Admin", email: "admin@test.invalid", role: "admin", status: "active", passwordHash: hash },
    { fullName: "A Dev", email: "dev@test.invalid", role: "developer", status: "active", passwordHash: hash },
    { fullName: "A Rep", email: "sales@test.invalid", role: "sales", status: "active", passwordHash: hash },
    { fullName: "A Client", email: "client@test.invalid", role: "client", status: "active", passwordHash: hash },
    { fullName: "Left Us", email: "gone@test.invalid", role: "sales", status: "inactive", passwordHash: hash },
  ]);

  async function signIn(email: string, pw: string, role?: string) {
    const response = await POST(post(role ? { email, password: pw, role } : { email, password: pw }));
    return { status: response.status, body: await response.json(), response };
  }

  // --- Every role signs in through the same form, with no role supplied.
  for (const [email, expectedRole] of [
    ["admin@test.invalid", "admin"],
    ["dev@test.invalid", "developer"],
    ["sales@test.invalid", "sales"],
    ["client@test.invalid", "client"],
  ] as const) {
    const { status, body, response } = await signIn(email, password);
    assert.equal(status, 200, `${expectedRole} should be able to sign in: ${JSON.stringify(body)}`);
    assert.equal(body.data.user.role, expectedRole, "the account's own role is what comes back");
    assert.ok(
      response.headers.get("set-cookie")?.includes("hrms_session="),
      "a session cookie should be set",
    );
  }

  // --- Clients previously needed a separate form and endpoint.
  assert.equal(getHomeRouteForRole("client"), "/client");
  assert.equal(getHomeRouteForRole("developer"), "/tasks");
  assert.equal(getHomeRouteForRole("sales"), "/dashboard");

  // --- A wrong password is still refused, and says nothing about the account.
  const wrong = await signIn("admin@test.invalid", "not-the-password");
  assert.equal(wrong.status, 401);
  assert.match(wrong.body.error.message, /Invalid email or password/);

  // --- An unknown address is refused identically, so the form cannot be used to
  //     discover who has an account.
  const unknown = await signIn("nobody@test.invalid", password);
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.error.message, wrong.body.error.message);

  // --- A deactivated account cannot sign in.
  const inactive = await signIn("gone@test.invalid", password);
  assert.equal(inactive.status, 403);

  // --- The old per-role portals still work, and still refuse a mismatch.
  assert.equal((await signIn("admin@test.invalid", password, "admin")).status, 200);
  assert.equal((await signIn("dev@test.invalid", password, "admin")).status, 401,
    "an explicit role must still have to match");

  // --- "Keep me signed in" controls how long the session outlives the browser.
  const persistent = await POST(post({ email: "admin@test.invalid", password, rememberMe: true }));
  assert.match(
    persistent.headers.get("set-cookie") ?? "",
    /Max-Age=\d+/,
    "keeping signed in should set a persistent cookie",
  );

  const sessionOnly = await POST(post({ email: "admin@test.invalid", password, rememberMe: false }));
  const sessionCookie = sessionOnly.headers.get("set-cookie") ?? "";
  assert.ok(sessionCookie.includes("hrms_session="), "a session cookie is still issued");
  assert.ok(
    !/Max-Age=\d+/.test(sessionCookie) && !/Expires=/i.test(sessionCookie),
    "unchecked should give a cookie that dies with the browser",
  );

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log("universal login checks passed");
}

main().catch(async (error) => {
  console.error(error);
  try { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } catch {}
  process.exit(1);
});

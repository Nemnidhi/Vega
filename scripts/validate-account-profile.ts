/**
 * Self-service profile editing.
 *
 * The risk here is not the form, it is the endpoint: it writes to a user record
 * using an id taken from the session, so the checks that matter are that it
 * cannot be pointed at somebody else and cannot reach the fields that decide
 * access or pay.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";

const uri = process.env.PROFILE_TEST_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27017\/hrms_profile_test_[a-z0-9]+$/.test(uri)) {
  throw new Error("Use an isolated test database: hrms_profile_test_<suffix> on 127.0.0.1:27017");
}

process.env.MONGODB_URI = uri;
process.env.MONGODB_DB_NAME = uri.split("/").pop()!;
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? crypto.randomBytes(32).toString("hex");

async function main() {
  const { updateOwnProfileSchema } = await import("@/lib/validation/user");
  const { UserModel } = await import("@/models");

  await mongoose.connect(uri!);

  const me = await UserModel.create({
    fullName: "Original Name", email: "me@test.invalid", role: "developer",
    status: "active", phone: "111", department: "Eng", baseSalary: 50000,
  });

  // --- The fields a person may change about themselves.
  const allowed = updateOwnProfileSchema.parse({
    fullName: "New Name", phone: "222", department: "Platform",
  });
  assert.deepEqual(allowed, { fullName: "New Name", phone: "222", department: "Platform" });

  // --- Everything that decides access or pay is dropped, not accepted. Zod
  //     strips unknown keys, so the endpoint can never write them even if they
  //     are posted.
  const stripped = updateOwnProfileSchema.parse({
    fullName: "New Name",
    role: "admin",
    status: "inactive",
    email: "hijack@test.invalid",
    baseSalary: 999999,
    managerId: "507f1f77bcf86cd799439011",
  } as never) as Record<string, unknown>;

  for (const field of ["role", "status", "email", "baseSalary", "managerId"]) {
    assert.equal(stripped[field], undefined, `${field} must not survive parsing`);
  }
  assert.equal(Object.keys(stripped).length, 1, "only the name should have come through");

  // --- An empty update is refused rather than silently doing nothing.
  assert.throws(() => updateOwnProfileSchema.parse({}), "an empty payload should be rejected");

  // --- Length limits hold, so the form cannot be used to write unbounded data.
  assert.throws(() => updateOwnProfileSchema.parse({ fullName: "x" }), "a one-character name is refused");
  assert.throws(
    () => updateOwnProfileSchema.parse({ fullName: "x".repeat(200) }),
    "an over-long name is refused",
  );
  assert.throws(
    () => updateOwnProfileSchema.parse({ phone: "9".repeat(60) }),
    "an over-long phone is refused",
  );

  // --- Applying only the parsed fields leaves role, status and salary intact.
  const parsed = updateOwnProfileSchema.parse({ fullName: "Renamed", phone: "333" });
  const target = await UserModel.findById(me._id);
  if (parsed.fullName !== undefined) target!.fullName = parsed.fullName;
  if (parsed.phone !== undefined) target!.phone = parsed.phone;
  if (parsed.department !== undefined) target!.department = parsed.department;
  await target!.save();

  const after = await UserModel.findById(me._id).lean();
  assert.equal(after!.fullName, "Renamed");
  assert.equal(after!.phone, "333");
  assert.equal(after!.department, "Eng", "a field left out of the payload is untouched");
  assert.equal(after!.role, "developer", "role is not self-editable");
  assert.equal(after!.status, "active", "status is not self-editable");
  assert.equal(after!.email, "me@test.invalid", "email is not self-editable");
  assert.equal(after!.baseSalary, 50000, "salary is not self-editable");

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log("account profile checks passed");
}

main().catch(async (error) => {
  console.error(error);
  try { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } catch {}
  process.exit(1);
});

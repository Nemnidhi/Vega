import { model, models, Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 180,
      index: true,
    },
    role: {
      type: String,
      enum: [
        "admin",
        "partner",
        "sales",
        "digital_marketing",
        "project_manager",
        "developer",
        "client",
      ],
      required: true,
      index: true,
    },
    passwordHash: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "invited"],
      default: "invited",
      required: true,
      index: true,
    },
    phone: { type: String, trim: true, maxlength: 30 },
    department: { type: String, trim: true, maxlength: 120 },
    avatarUrl: { type: String, trim: true, maxlength: 500 },
    managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    lastLoginAt: { type: Date, default: null },
    /**
     * Bumped whenever a change should invalidate every session this user already holds -
     * deactivation, a role change, a password change. The session cookie carries the value
     * it was minted with, and getCurrentSession rejects a token whose value is stale.
     *
     * Without it, role and status were frozen in the cookie for its full 7-day life, so
     * deactivating or demoting someone had no effect until it expired. Existing rows have no
     * field; `default: 0` and the null-coalescing comparison in the session check treat
     * missing as 0, so old cookies keep working until their own expiry.
     */
    sessionVersion: { type: Number, default: 0, required: true },
  },
  {
    timestamps: true,
  },
);

export type UserDocument = InferSchemaType<typeof userSchema>;

export const UserModel = models.User || model("User", userSchema);

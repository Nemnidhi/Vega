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
        "project_manager",
        "developer",
        "client",
      ],
      required: true,
      index: true,
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
  },
  {
    timestamps: true,
  },
);

export type UserDocument = InferSchemaType<typeof userSchema>;

export const UserModel = models.User || model("User", userSchema);

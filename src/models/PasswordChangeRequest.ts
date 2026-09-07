import { model, models, Schema, type InferSchemaType } from "mongoose";

const passwordChangeRequestSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requestedPasswordHash: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      required: true,
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

passwordChangeRequestSchema.index(
  { userId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  },
);
passwordChangeRequestSchema.index({ status: 1, createdAt: -1 });

export type PasswordChangeRequestDocument = InferSchemaType<
  typeof passwordChangeRequestSchema
>;

export const PasswordChangeRequestModel =
  models.PasswordChangeRequest ||
  model("PasswordChangeRequest", passwordChangeRequestSchema);

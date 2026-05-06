import { model, models, Schema, type InferSchemaType } from "mongoose";

const leaveRequestSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    leaveType: {
      type: String,
      enum: ["casual", "sick", "planned", "unpaid", "other"],
      required: true,
      index: true,
    },
    startDateKey: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    endDateKey: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    totalDays: {
      type: Number,
      min: 1,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
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

leaveRequestSchema.index({ userId: 1, createdAt: -1 });
leaveRequestSchema.index({ userId: 1, startDateKey: 1, endDateKey: 1 });

export type LeaveRequestDocument = InferSchemaType<typeof leaveRequestSchema>;

export const LeaveRequestModel =
  models.LeaveRequest || model("LeaveRequest", leaveRequestSchema);

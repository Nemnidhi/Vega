import { model, models, Schema, type InferSchemaType } from "mongoose";

const leaveBalanceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    availableDays: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
    },
    totalAccruedDays: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
    },
    totalUsedDays: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
    },
    lastAccrualMonth: {
      type: String,
      match: /^\d{4}-\d{2}$/,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

leaveBalanceSchema.index({ userId: 1 }, { unique: true });

export type LeaveBalanceDocument = InferSchemaType<typeof leaveBalanceSchema>;

export const LeaveBalanceModel =
  models.LeaveBalance || model("LeaveBalance", leaveBalanceSchema);

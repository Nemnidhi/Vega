import { model, models, Schema, type InferSchemaType } from "mongoose";

const attendanceSettingsSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "default",
    },
    officeLatitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },
    officeLongitude: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },
    officeRadiusMeters: {
      type: Number,
      min: 1,
      default: 200,
    },
    // "HH:mm" in Asia/Kolkata, e.g. "10:00". Null means no late rule is configured, in which case
    // check-in never auto-marks late_coming - see lib/attendance/late-rule.ts.
    shiftStartTime: {
      type: String,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
      default: null,
    },
    lateGraceMinutes: {
      type: Number,
      min: 0,
      max: 180,
      default: null,
    },
    updatedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export type AttendanceSettingsDocument = InferSchemaType<typeof attendanceSettingsSchema>;

export const AttendanceSettingsModel =
  models.AttendanceSettings || model("AttendanceSettings", attendanceSettingsSchema);

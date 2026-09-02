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

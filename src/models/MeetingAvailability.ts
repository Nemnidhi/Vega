import { model, models, Schema, type InferSchemaType } from "mongoose";

// Singleton config - the only write path is findOneAndUpdate({}, {$set:...}, {upsert:true}).
// No seed data ships with this; an admin must configure at least one weekly window before any
// slots appear, since guessing office hours would be worse than an empty list.
const weeklyWindowSchema = new Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    // "HH:MM" IST wall-clock, not a Date - see src/lib/meetings/date.ts for the conversion.
    startTime: { type: String, required: true, trim: true, maxlength: 5 },
    endTime: { type: String, required: true, trim: true, maxlength: 5 },
  },
  { _id: false },
);

const meetingAvailabilitySchema = new Schema(
  {
    weeklyWindows: { type: [weeklyWindowSchema], default: [] },
    slotDurationMinutes: { type: Number, default: 30, min: 5 },
    bufferMinutes: { type: Number, default: 0, min: 0 },
    maxConcurrentBookings: {
      online: { type: Number, default: 1, min: 1 },
      in_person: { type: Number, default: 1, min: 1 },
    },
    bookingWindowDays: { type: Number, default: 21, min: 1, max: 90 },
    // Never offer a slot less than this many hours from now - without it the system could
    // hand out a slot 10 minutes away that's operationally unbookable.
    minNoticeHours: { type: Number, default: 12, min: 0 },
    // "YYYY-MM-DD" IST date-key strings (see src/lib/meetings/date.ts's getMeetingDateKey) -
    // deliberately not Date objects, so they compare directly against the string keys the
    // slot generator produces with zero UTC-midnight ambiguity.
    blackoutDates: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type MeetingAvailabilityDocument = InferSchemaType<typeof meetingAvailabilitySchema>;

export const MeetingAvailabilityModel =
  models.MeetingAvailability || model("MeetingAvailability", meetingAvailabilitySchema);

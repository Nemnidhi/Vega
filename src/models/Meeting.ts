import { model, models, Schema, type InferSchemaType } from "mongoose";

const meetingSchema = new Schema(
  {
    type: { type: String, enum: ["online", "in_person"], required: true, index: true },
    // The real UTC instant, computed server-side from an IST wall-clock day+time via
    // src/lib/meetings/date.ts's istWallTimeToUtc - never trust a client-supplied instant.
    startAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, required: true, min: 5 },
    clientUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
    // Denormalized from the User record at booking time, same spirit as Lead's own
    // contactName/email/phone - a booking should still read correctly if the account changes later.
    contactName: { type: String, required: true, trim: true, maxlength: 120 },
    contactEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 180 },
    contactPhone: { type: String, trim: true, maxlength: 30 },
    notes: { type: String, trim: true, maxlength: 1000, default: "" },
    status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed", required: true, index: true },
    // Nullable - staff self-assign later, not required at booking time.
    assignedToUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    // The Indore office address for in-person, or a placeholder note for online (no real
    // video-conferencing integration exists yet).
    location: { type: String, required: true, trim: true, maxlength: 300 },
    cancelledAt: { type: Date, default: null },
    cancelledReason: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true },
);

// The exact shape both slot-computation and the booking-time race recheck query against.
meetingSchema.index({ startAt: 1, type: 1, status: 1 });

export type MeetingDocument = InferSchemaType<typeof meetingSchema>;

export const MeetingModel = models.Meeting || model("Meeting", meetingSchema);

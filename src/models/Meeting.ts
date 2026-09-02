import { model, models, Schema, type InferSchemaType } from "mongoose";

const meetingSchema = new Schema(
  {
    type: { type: String, enum: ["online", "in_person"], required: true, index: true },
    // The real UTC instant, computed server-side from an IST wall-clock day+time via
    // src/lib/meetings/date.ts's istWallTimeToUtc - never trust a client-supplied instant.
    startAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, required: true, min: 5 },
    // Nullable - only set for a portal-client self-booking (client-portal/meetings/book). A
    // WhatsApp-lead booking (integrations/meetings/book) has no portal account at all, and is
    // identified by leadId/contactPhone instead - route-level validation enforces that at least
    // one of clientUserId/leadId/contactPhone is present, the schema itself doesn't.
    clientUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
    // Denormalized from the User record at booking time, same spirit as Lead's own
    // contactName/email/phone - a booking should still read correctly if the account changes later.
    contactName: { type: String, required: true, trim: true, maxlength: 120 },
    // Optional - a WhatsApp-only lead usually has no email. contactPhone stays the reliable
    // identifier for that path (see the clientUserId comment above).
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 180, default: "" },
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
    // Reminder-sweep watermarks, not a schedule config - the sweep queries "status confirmed,
    // startAt within N hours, this field still null" then sets it on send. Null forever = never
    // reminded for that tier; set = don't re-send even if the sweep re-scans this meeting.
    reminded24hAt: { type: Date, default: null },
    reminded1hAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// The exact shape both slot-computation and the booking-time race recheck query against.
meetingSchema.index({ startAt: 1, type: 1, status: 1 });
// The reminder sweep's own query shape - status + startAt range + one of the reminded*At nulls.
meetingSchema.index({ status: 1, startAt: 1, reminded24hAt: 1 });
meetingSchema.index({ status: 1, startAt: 1, reminded1hAt: 1 });

export type MeetingDocument = InferSchemaType<typeof meetingSchema>;

export const MeetingModel = models.Meeting || model("Meeting", meetingSchema);

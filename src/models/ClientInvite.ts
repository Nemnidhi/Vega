import { model, models, Schema, type InferSchemaType } from "mongoose";

/**
 * A staff-initiated invite for a lead's contact to get a client-portal
 * login during the lead phase - distinct from the self-serve website signup
 * (clientSignupSchema), which only ever auto-links source:"website" leads.
 * Cold-outreach leads have no way to discover that signup page, so someone
 * on staff has to send them a link.
 */
const clientInviteSchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 180 },
    invitedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // The raw token is never stored - only its hash, same reasoning as a
    // password hash. Anyone who reads this row cannot use it to log in.
    tokenHash: { type: String, required: true, trim: true, maxlength: 128 },
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked", "expired"],
      default: "pending",
      required: true,
      index: true,
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    createdClientUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

clientInviteSchema.index(
  { leadId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  },
);
clientInviteSchema.index({ status: 1, createdAt: -1 });

export type ClientInviteDocument = InferSchemaType<typeof clientInviteSchema>;

export const ClientInviteModel = models.ClientInvite || model("ClientInvite", clientInviteSchema);

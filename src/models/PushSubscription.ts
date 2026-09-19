import { model, models, Schema, type InferSchemaType } from "mongoose";

/**
 * One row per browser/device a user has granted notification permission on, so a
 * single person signed in on a phone and a laptop gets the push on both.
 *
 * The endpoint is the push service's own URL for that device and is unique across
 * all users - re-subscribing on the same device returns the same endpoint, and a
 * device handed to another employee must not keep pushing to the old owner. Both
 * are handled by upserting on the endpoint alone.
 */
const pushSubscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true, trim: true, maxlength: 2000 },
    // Encryption material from the browser's PushSubscription; web-push needs both verbatim.
    p256dh: { type: String, required: true, trim: true, maxlength: 255 },
    auth: { type: String, required: true, trim: true, maxlength: 255 },
    userAgent: { type: String, trim: true, maxlength: 400, default: "" },
    lastSuccessAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type PushSubscriptionDocument = InferSchemaType<typeof pushSubscriptionSchema>;

export const PushSubscriptionModel =
  models.PushSubscription || model("PushSubscription", pushSubscriptionSchema);

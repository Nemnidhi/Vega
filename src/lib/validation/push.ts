import { z } from "zod";

/** Mirrors the browser's PushSubscription.toJSON() shape. */
export const savePushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

export const removePushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
});

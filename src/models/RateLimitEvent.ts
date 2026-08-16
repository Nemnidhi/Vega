import { model, models, Schema, type InferSchemaType } from "mongoose";

/**
 * One row per rate-limited attempt, self-cleaning via a TTL index. Nothing
 * in this codebase rate-limits anything today - the public questionnaire is
 * the first surface that genuinely needs it (an unauthenticated endpoint
 * that creates real Lead/Blueprint records, callable directly from a
 * browser). Deliberately a tiny dedicated collection rather than repurposing
 * Lead or ActivityLog, which exist for a different reason and would make
 * "how many attempts in the last hour" an awkward query.
 */
const rateLimitEventSchema = new Schema({
  key: { type: String, required: true, trim: true, maxlength: 200, index: true },
  createdAt: { type: Date, default: Date.now, expires: "1h" },
});

export type RateLimitEventDocument = InferSchemaType<typeof rateLimitEventSchema>;

export const RateLimitEventModel =
  models.RateLimitEvent || model("RateLimitEvent", rateLimitEventSchema);

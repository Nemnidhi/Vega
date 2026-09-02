import { model, models, Schema, type InferSchemaType } from "mongoose";

/**
 * Monotonic sequence source for human-readable display codes (TASK-2478, PRJ-104).
 *
 * These codes are display/reference identifiers only - never a substitute for `_id`. The previous
 * approach probed for a free code with `exists()` in a loop, which races under concurrent writes
 * and 500s on the unique index instead of retrying. A single atomic `$inc` removes that class of
 * failure entirely.
 */

const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

export type CounterDocument = InferSchemaType<typeof counterSchema>;

export const CounterModel = models.Counter || model("Counter", counterSchema);

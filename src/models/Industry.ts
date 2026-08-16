import { model, models, Schema, type InferSchemaType } from "mongoose";

// Top-level industry list - the same slugs used by INDUSTRY_KNOWLEDGE
// (src/lib/prospecting/industry-knowledge.ts) and Lead.prospecting.industry,
// promoted into an editable collection so marketing can add a new industry
// without a code deploy. `key` intentionally mirrors those existing slugs
// (e.g. "textile_apparel") rather than inventing a second taxonomy.
const industrySchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 60,
      index: true,
    },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    sortOrder: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

industrySchema.index({ isActive: 1, sortOrder: 1 });

export type IndustryDocument = InferSchemaType<typeof industrySchema>;

export const IndustryModel = models.Industry || model("Industry", industrySchema);

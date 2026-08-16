import { model, models, Schema, type InferSchemaType } from "mongoose";

// The "business type" within an industry (Manufacturer / Wholesaler / Clinic
// & Doctor / Law Firm / CA Firm ...) - what INDUSTRY_KNOWLEDGE calls a
// "segment" for report-copy purposes, promoted here into an editable
// collection so a new business type can be added by marketing directly,
// instead of requiring a code change to industry-knowledge.ts.
const industrySegmentSchema = new Schema(
  {
    industryId: { type: Schema.Types.ObjectId, ref: "Industry", required: true, index: true },
    key: { type: String, required: true, trim: true, lowercase: true, maxlength: 60 },
    label: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    sortOrder: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

industrySegmentSchema.index({ industryId: 1, key: 1 }, { unique: true });
industrySegmentSchema.index({ industryId: 1, isActive: 1, sortOrder: 1 });

export type IndustrySegmentDocument = InferSchemaType<typeof industrySegmentSchema>;

export const IndustrySegmentModel =
  models.IndustrySegment || model("IndustrySegment", industrySegmentSchema);

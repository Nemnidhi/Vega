import { model, models, Schema, type InferSchemaType } from "mongoose";

// Which components a package bundles in, and at what status - the digital
// equivalent of one column (one tier) of an industry pricing sheet.
const packageComponentSchema = new Schema(
  {
    componentId: { type: Schema.Types.ObjectId, ref: "PricingComponent", required: true },
    status: {
      type: String,
      enum: ["included", "addon", "unavailable"],
      required: true,
      default: "unavailable",
    },
  },
  { _id: false },
);

// A per-pillar price breakdown, mirroring the pricing sheet's Marketing &
// Sales / Operations / Documentation & Administration / Service & Support
// columns. Kept alongside the flat setupPrice/monthlyPrice rather than
// replacing them - the flat totals are what a client sees first, the
// per-pillar split is what backs the "why does this cost X" breakdown.
const pillarPricingSchema = new Schema(
  {
    marketing_sales: { type: Number, required: true, default: 0, min: 0 },
    operations: { type: Number, required: true, default: 0, min: 0 },
    documentation_admin: { type: Number, required: true, default: 0, min: 0 },
    service_support: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
);

// One row of a pricing sheet: a specific Industry (+ optional Segment) at a
// specific Tier. segmentId is nullable on purpose - some industries are
// priced flat with no business-type breakdown, matching how
// INDUSTRY_KNOWLEDGE entries without a `segments` map stay flat too.
const pricingPackageSchema = new Schema(
  {
    industryId: { type: Schema.Types.ObjectId, ref: "Industry", required: true, index: true },
    segmentId: { type: Schema.Types.ObjectId, ref: "IndustrySegment", default: null, index: true },
    tierId: { type: Schema.Types.ObjectId, ref: "PricingTier", required: true, index: true },
    bestForDescription: { type: String, trim: true, maxlength: 300, default: "" },
    setupPrice: { type: Number, required: true, default: 0, min: 0 },
    monthlyPrice: { type: Number, required: true, default: 0, min: 0 },
    pillarPricing: { type: pillarPricingSchema, default: () => ({}) },
    componentInclusions: { type: [packageComponentSchema], default: [] },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// One package per (industry, segment, tier) combination - segmentId being
// null still participates correctly in a unique compound index in MongoDB
// (null is a distinct indexable value), so "no segment breakdown" only ever
// has one row per industry/tier too.
pricingPackageSchema.index({ industryId: 1, segmentId: 1, tierId: 1 }, { unique: true });
pricingPackageSchema.index({ industryId: 1, isActive: 1 });

export type PricingPackageDocument = InferSchemaType<typeof pricingPackageSchema>;

export const PricingPackageModel =
  models.PricingPackage || model("PricingPackage", pricingPackageSchema);

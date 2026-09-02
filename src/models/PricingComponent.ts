import { model, models, Schema, type InferSchemaType } from "mongoose";

// A choice made on the discovery call, not a separate thing to sell.
// `priceImpact` is applied before margin, so a feature cannot drag a quote
// below the protected floor either.
const componentFeatureSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 60 },
    label: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 500 },
    priceImpact: { type: Number, required: true, default: 0 },
    isDefault: { type: Boolean, default: false },
    requires: [{ type: String, trim: true, uppercase: true, maxlength: 60 }],
  },
  { _id: false },
);

const pricingComponentSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      maxlength: 80,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: {
      type: String,
      enum: [
        "website",
        "mobile",
        "intake",
        "crm",
        "automation",
        "integration",
        "analytics",
        "ai",
        "operations",
      ],
      required: true,
      index: true,
    },
    // Coarse commercial grouping matching the pricing-sheet pillars a
    // PricingPackage bundles by - separate from `category` above, which is
    // the finer internal classification already used elsewhere (blueprint
    // recommendation, gap-tag matching). A component keeps one category but
    // is sold under exactly one pillar.
    pillar: {
      type: String,
      enum: ["marketing_sales", "operations", "documentation_admin", "service_support"],
      required: true,
      default: "operations",
      index: true,
    },
    basePrice: { type: Number, required: true, min: 0 },
    complexityMultiplier: { type: Number, required: true, min: 1, default: 1 },
    marginPercentage: { type: Number, required: true, min: 0, max: 300, default: 30 },
    finalPrice: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    features: { type: [componentFeatureSchema], default: [] },
    // Empty means "suits every industry". Populated only where a component
    // genuinely does not apply elsewhere.
    appliesToIndustries: [{ type: String, trim: true, maxlength: 60 }],
    // Segment-level scoping, alongside the industry-level field above. Empty
    // means "every segment of every applicable industry" - populated only
    // where a component is genuinely specific to certain business types
    // (e.g. a component that only makes sense for a Manufacturer, not a
    // Retailer, within the same industry).
    appliesToSegments: [{ type: Schema.Types.ObjectId, ref: "IndustrySegment" }],
    // Ties the catalog back to the audit: a lead missing a website has the
    // "website" gap tag, and this is what answers it.
    answersGapTags: [{ type: String, trim: true, maxlength: 40 }],
    // Which size of business this is priced for. A blueprint drawing from the
    // wrong tier would quote an order-of-magnitude error, so it is explicit.
    scaleTiers: [{ type: String, enum: ["smb", "midmarket", "enterprise"] }],
    /** Where the price came from. Kept on the record so guesses stay visible. */
    priceBasis: { type: String, trim: true, maxlength: 300, default: "" },
    deliveryWeeksMin: { type: Number, default: 1, min: 0 },
    deliveryWeeksMax: { type: Number, default: 2, min: 0 },
    monthlyPrice: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

pricingComponentSchema.pre("validate", function updateFinalPrice() {
  if (this.isModified("basePrice") || this.isModified("complexityMultiplier") || this.isModified("marginPercentage")) {
    const base = Number(this.get("basePrice")) || 0;
    const multiplier = Number(this.get("complexityMultiplier")) || 1;
    const margin = Number(this.get("marginPercentage")) || 0;
    const computed = base * multiplier * (1 + margin / 100);
    this.set("finalPrice", Number(computed.toFixed(2)));
  }
});

export type PricingComponentDocument = InferSchemaType<typeof pricingComponentSchema>;

const existingPricingComponentModel = models.PricingComponent;

// In dev HMR, an older cached model can predate the pillar/appliesToSegments
// fields added alongside the pricing-package work.
if (existingPricingComponentModel && !existingPricingComponentModel.schema.path("pillar")) {
  delete models.PricingComponent;
}

export const PricingComponentModel =
  models.PricingComponent || model("PricingComponent", pricingComponentSchema);

import { model, models, Schema, type InferSchemaType } from "mongoose";

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
      enum: ["intake", "crm", "automation", "integration", "analytics", "ai", "operations"],
      required: true,
      index: true,
    },
    basePrice: { type: Number, required: true, min: 0 },
    complexityMultiplier: { type: Number, required: true, min: 1, default: 1 },
    marginPercentage: { type: Number, required: true, min: 0, max: 300, default: 30 },
    finalPrice: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
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

export const PricingComponentModel =
  models.PricingComponent || model("PricingComponent", pricingComponentSchema);

import { model, models, Schema, type InferSchemaType } from "mongoose";

// The sellable package tiers (Launch Essentials / Growth Professional / Scale
// Advanced / Enterprise Custom) as editable data rather than a hardcoded
// enum, so marketing can rename or add a tier without a code deploy. Global,
// not per-industry - every PricingPackage references one of these by id.
const pricingTierSchema = new Schema(
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
    order: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

pricingTierSchema.index({ isActive: 1, order: 1 });

export type PricingTierDocument = InferSchemaType<typeof pricingTierSchema>;

export const PricingTierModel = models.PricingTier || model("PricingTier", pricingTierSchema);

import { z } from "zod";

export const pricingCategoryValues = [
  "website",
  "mobile",
  "intake",
  "crm",
  "automation",
  "integration",
  "analytics",
  "ai",
  "operations",
] as const;

export const pricingPillarValues = [
  "marketing_sales",
  "operations",
  "documentation_admin",
  "service_support",
] as const;

export const scaleTierValues = ["smb", "midmarket", "enterprise"] as const;

const objectIdString = z.string().trim().regex(/^[a-f0-9]{24}$/i, "Must be a valid id");

const componentFeatureSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .transform((value) => value.toUpperCase()),
  label: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional().default(""),
  priceImpact: z.number().default(0),
  isDefault: z.boolean().optional().default(false),
  requires: z.array(z.string().trim().max(60)).optional().default([]),
});

export const upsertPricingComponentSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .transform((value) => value.toUpperCase()),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(5).max(2000),
  category: z.enum(pricingCategoryValues),
  pillar: z.enum(pricingPillarValues),
  basePrice: z.number().min(0),
  complexityMultiplier: z.number().min(1),
  marginPercentage: z.number().min(0).max(300),
  isActive: z.boolean().optional().default(true),
  features: z.array(componentFeatureSchema).optional().default([]),
  appliesToIndustries: z.array(z.string().trim().max(60)).optional().default([]),
  appliesToSegments: z.array(objectIdString).optional().default([]),
  answersGapTags: z.array(z.string().trim().max(40)).optional().default([]),
  scaleTiers: z.array(z.enum(scaleTierValues)).optional().default([]),
  priceBasis: z.string().trim().max(300).optional().default(""),
  deliveryWeeksMin: z.number().min(0).optional().default(1),
  deliveryWeeksMax: z.number().min(0).optional().default(2),
  monthlyPrice: z.number().min(0).optional().default(0),
});

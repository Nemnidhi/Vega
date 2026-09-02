import { z } from "zod";

const objectIdString = z.string().trim().regex(/^[a-f0-9]{24}$/i, "Must be a valid id");

export const upsertPricingTierSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .transform((value) => value.toLowerCase().replace(/\s+/g, "_")),
  label: z.string().trim().min(2).max(120),
  order: z.number().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const packageComponentSchema = z.object({
  componentId: objectIdString,
  status: z.enum(["included", "addon", "unavailable"]),
});

const pillarPricingSchema = z.object({
  marketing_sales: z.number().min(0).default(0),
  operations: z.number().min(0).default(0),
  documentation_admin: z.number().min(0).default(0),
  service_support: z.number().min(0).default(0),
});

export const upsertPricingPackageSchema = z.object({
  industryId: objectIdString,
  segmentId: objectIdString.nullable().optional().default(null),
  tierId: objectIdString,
  bestForDescription: z.string().trim().max(300).optional().default(""),
  setupPrice: z.number().min(0).optional().default(0),
  monthlyPrice: z.number().min(0).optional().default(0),
  pillarPricing: pillarPricingSchema.optional().default({
    marketing_sales: 0,
    operations: 0,
    documentation_admin: 0,
    service_support: 0,
  }),
  componentInclusions: z.array(packageComponentSchema).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

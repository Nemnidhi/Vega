import { z } from "zod";

export const pricingCategoryValues = [
  "intake",
  "crm",
  "automation",
  "integration",
  "analytics",
  "ai",
  "operations",
] as const;

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
  basePrice: z.number().min(0),
  complexityMultiplier: z.number().min(1),
  marginPercentage: z.number().min(0).max(300),
  isActive: z.boolean().optional().default(true),
});

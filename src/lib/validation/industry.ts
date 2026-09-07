import { z } from "zod";

const objectIdString = z.string().trim().regex(/^[a-f0-9]{24}$/i, "Must be a valid id");

export const upsertIndustrySchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .transform((value) => value.toLowerCase().replace(/\s+/g, "_")),
  label: z.string().trim().min(2).max(120),
  sortOrder: z.number().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const upsertIndustrySegmentSchema = z.object({
  industryId: objectIdString,
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .transform((value) => value.toLowerCase().replace(/\s+/g, "_")),
  label: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).optional().default(""),
  sortOrder: z.number().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

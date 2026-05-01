import { z } from "zod";

export const leadSourceValues = [
  "website",
  "referral",
  "cold_outreach",
  "paid_ads",
  "event",
  "partner",
  "other",
] as const;

export const leadStatusValues = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;

export const leadCategoryValues = [
  "software_request",
  "infrastructure",
  "legal_automation",
  "retainer_enterprise",
  "other",
] as const;

export const leadUrgencyValues = ["low", "medium", "high", "critical"] as const;

export const leadBudgetSchema = z
  .object({
    min: z.number().min(0),
    max: z.number().min(0),
    currency: z.enum(["INR", "USD"]).default("INR"),
  })
  .refine((value) => value.max >= value.min, {
    message: "budget.max must be greater than or equal to budget.min",
    path: ["max"],
  });

export const createLeadSchema = z.object({
  title: z.string().trim().min(3).max(200),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().email(),
  phone: z.string().trim().max(30).optional(),
  source: z.enum(leadSourceValues),
  status: z.enum(leadStatusValues).optional().default("new"),
  category: z.enum(leadCategoryValues),
  urgency: z.enum(leadUrgencyValues),
  budget: leadBudgetSchema.optional(),
  description: z.string().trim().min(10).max(5000),
  sourceDomain: z.string().trim().max(180).optional(),
  sourcePath: z.string().trim().max(500).optional(),
  sourceReferrer: z.string().trim().max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).optional().default([]),
});

export const updateLeadStatusSchema = z.object({
  status: z.enum(leadStatusValues),
});

export const createWebsiteLeadSchema = createLeadSchema
  .omit({
    source: true,
    status: true,
    sourceDomain: true,
    sourcePath: true,
    sourceReferrer: true,
  })
  .extend({
    source: z.literal("website").optional(),
  })
  .transform((value) => ({
    ...value,
    source: "website" as const,
  }));

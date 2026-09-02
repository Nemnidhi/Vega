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
  "invalid",
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

export const prospectingStatusValues = [
  "new",
  "enriched",
  "classified",
  "reported",
  "sent",
] as const;

export const prospectingTierValues = ["A", "B", "C", "D"] as const;

export const prospectingConfidenceValues = ["partial", "full"] as const;

/**
 * Base shape. `contactName`, `email`, `category`, `urgency` and `description`
 * are optional here and re-required by `createLeadSchema` for every source
 * except `cold_outreach` - prospects sourced from public registries have a
 * business name and nothing else. Kept as a plain object (not a refined
 * schema) so `.omit()` / `.extend()` / `.partial()` still work on it - which
 * `createLeadSchema` itself no longer supports, being a refined schema.
 */
export const leadBaseSchema = z.object({
  title: z.string().trim().min(3).max(200),
  contactName: z.string().trim().min(2).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().max(30).optional(),
  source: z.enum(leadSourceValues),
  status: z.enum(leadStatusValues).optional().default("new"),
  category: z.enum(leadCategoryValues).optional(),
  urgency: z.enum(leadUrgencyValues).optional(),
  budget: leadBudgetSchema.optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  sourceDomain: z.string().trim().max(180).optional(),
  sourcePath: z.string().trim().max(500).optional(),
  sourceReferrer: z.string().trim().max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).optional().default([]),
});

const inboundRequiredFields = [
  "contactName",
  "email",
  "category",
  "urgency",
  "description",
] as const;

export const createLeadSchema = leadBaseSchema.superRefine((value, ctx) => {
  if (value.source === "cold_outreach") {
    return;
  }

  for (const field of inboundRequiredFields) {
    if (value[field] === undefined) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: `${field} is required unless source is cold_outreach`,
      });
    }
  }
});

export const updateLeadStatusSchema = z.object({
  status: z.enum(leadStatusValues),
});

// Public website intake stays fully strict - none of the relaxations above
// apply to a form a stranger can POST to.
export const createWebsiteLeadSchema = leadBaseSchema
  .omit({
    source: true,
    status: true,
    sourceDomain: true,
    sourcePath: true,
    sourceReferrer: true,
  })
  .extend({
    source: z.literal("website").optional(),
    contactName: z.string().trim().min(2).max(120),
    email: z.string().email(),
    category: z.enum(leadCategoryValues),
    urgency: z.enum(leadUrgencyValues),
    description: z.string().trim().min(10).max(5000),
  })
  .transform((value) => ({
    ...value,
    source: "website" as const,
  }));

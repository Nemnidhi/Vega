import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

export const proposalStatusValues = [
  "draft",
  "generated",
  "sent",
  "viewed",
  "signed",
  "rejected",
] as const;

const milestoneSchema = z.object({
  label: z.string().trim().min(2).max(200),
  amount: z.number().min(0),
  dueBy: z.string().datetime().nullable().optional(),
  currency: z.enum(["INR", "USD"]).default("INR"),
});

const pricingLineSchema = z.object({
  componentId: objectIdSchema.nullish(),
  label: z.string().trim().min(2).max(200),
  amount: z.number().min(0),
  quantity: z.number().int().min(1).default(1),
  currency: z.enum(["INR", "USD"]).default("INR"),
});

export const createProposalSchema = z.object({
  leadId: objectIdSchema,
  clientId: objectIdSchema,
  scopeManifestId: objectIdSchema,
  projectSummary: z.string().trim().min(10).max(5000),
  scopeOfWork: z.array(z.string().trim().min(2).max(300)).min(1),
  exclusions: z.array(z.string().trim().min(2).max(300)).min(1),
  timeline: z.string().trim().min(5).max(1000),
  milestones: z.array(milestoneSchema).default([]),
  pricing: z.array(pricingLineSchema).min(1),
  paymentSchedule: z.array(milestoneSchema).min(1),
  changeOrderClause: z.string().trim().min(5).max(2000),
  signatureBlock: z.string().trim().min(5).max(1000),
  status: z.enum(proposalStatusValues).optional().default("generated"),
  approvalStatus: z
    .enum(["draft", "pending", "approved", "rejected"])
    .optional()
    .default("pending"),
});

export const updateProposalStatusSchema = z.object({
  status: z.enum(proposalStatusValues),
});

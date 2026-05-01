import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

const stringArraySchema = z.array(z.string().trim().min(2).max(300)).min(1);

export const scopeMilestoneSchema = z.object({
  heading: z.string().trim().min(2).max(150),
  content: z.string().trim().min(2).max(2000),
});

export const upsertScopeManifestSchema = z.object({
  leadId: objectIdSchema,
  clientId: objectIdSchema,
  businessObjective: z.string().trim().min(10).max(2000),
  confirmedDeliverables: stringArraySchema,
  exclusions: stringArraySchema,
  clientResponsibilities: stringArraySchema,
  timelineAssumptions: stringArraySchema,
  paymentMilestones: z.array(scopeMilestoneSchema).min(1),
  revisionLimits: z.string().trim().min(5).max(1000),
  maintenanceTerms: z.string().trim().min(5).max(1000),
  changeOrderRules: z.string().trim().min(5).max(1000),
  isCompleted: z.boolean().optional().default(false),
  signedAt: z.string().datetime().nullable().optional(),
});

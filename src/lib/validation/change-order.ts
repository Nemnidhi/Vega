import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

export const createChangeOrderSchema = z.object({
  leadId: objectIdSchema,
  clientId: objectIdSchema,
  proposalId: objectIdSchema,
  scopeManifestId: objectIdSchema,
  requestedFeature: z.string().trim().min(5).max(1000),
  reasonOutOfScope: z.string().trim().min(5).max(1000),
  additionalPrice: z.number().min(0),
  currency: z.enum(["INR", "USD"]).default("INR"),
  timelineImpactDays: z.number().int().min(0).default(0),
  approvalStatus: z
    .enum(["draft", "pending", "approved", "rejected"])
    .optional()
    .default("pending"),
});

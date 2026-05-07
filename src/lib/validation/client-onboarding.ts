import { z } from "zod";

const onboardingChecklistSchema = z.object({
  accountSetup: z.boolean().default(false),
  businessProfile: z.boolean().default(false),
  requirementsShared: z.boolean().default(false),
  documentsShared: z.boolean().default(false),
  kickoffCallBooked: z.boolean().default(false),
});

export const clientOnboardingSchema = z.object({
  companyName: z.string().trim().max(200).default(""),
  primaryGoal: z.string().trim().max(240).default(""),
  kickoffDate: z.string().trim().optional().nullable(),
  preferredCommunication: z
    .enum(["email", "phone", "whatsapp", "slack", "meetings"])
    .default("email"),
  billingContactEmail: z.union([z.string().trim().email(), z.literal("")]).default(""),
  projectBrief: z.string().trim().max(2000).default(""),
  onboardingNotes: z.string().trim().max(1200).default(""),
  checklist: onboardingChecklistSchema.default({
    accountSetup: false,
    businessProfile: false,
    requirementsShared: false,
    documentsShared: false,
    kickoffCallBooked: false,
  }),
});

export type ClientOnboardingInput = z.infer<typeof clientOnboardingSchema>;

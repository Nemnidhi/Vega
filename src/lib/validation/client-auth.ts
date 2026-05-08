import { z } from "zod";

export const clientSignupSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().email(),
  phone: z.string().trim().min(8).max(30),
  legalName: z.string().trim().min(2).max(200),
  preferredCommunication: z.enum(["email", "phone", "whatsapp", "slack", "meetings"]).default("email"),
  primaryGoal: z.string().trim().min(3).max(240),
  requirementSummary: z.string().trim().min(10).max(500),
  requirementDetails: z.string().trim().max(3000).default(""),
  password: z.string().min(8).max(72),
});

export const clientLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

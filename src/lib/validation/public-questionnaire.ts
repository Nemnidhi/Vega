import { z } from "zod";
import { answerInputSchema } from "@/lib/validation/blueprint";

export const submitPublicQuestionnaireSchema = z.object({
  contactName: z.string().trim().min(2).max(120),
  email: z.string().email(),
  phone: z.string().trim().min(6).max(30).optional(),
  industry: z.string().trim().min(1).max(60),
  segment: z.string().trim().max(60).optional(),
  answers: z.array(answerInputSchema).min(1).max(30),
});

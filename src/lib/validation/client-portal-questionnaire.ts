import { z } from "zod";
import { answerInputSchema } from "@/lib/validation/blueprint";

export const submitClientPortalQuestionnaireSchema = z.object({
  clientUserId: z.string().min(1),
  industry: z.string().trim().min(1).max(60),
  segment: z.string().trim().max(60).optional(),
  answers: z.array(answerInputSchema).min(1).max(30),
});

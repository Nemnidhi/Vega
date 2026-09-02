import { z } from "zod";

export const answerInputSchema = z.object({
  questionCode: z.string().trim().min(1).max(60),
  values: z.array(z.string().trim().max(500)).max(20),
  note: z.string().trim().max(1000).optional(),
});

export const createBlueprintSchema = z.object({
  answers: z.array(answerInputSchema).min(1).max(30),
});

export const respondBlueprintSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().min(5).max(1000).optional(),
});

export const finalizeSelfServiceBlueprintSchema = z.object({
  selectedComponentCodes: z.array(z.string().trim().max(80)).max(200),
});

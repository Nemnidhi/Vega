import { z } from "zod";

export const clientSignupSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

export const clientLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

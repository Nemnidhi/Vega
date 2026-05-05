import { z } from "zod";

export const createClientQuerySchema = z.object({
  projectName: z.string().trim().min(2).max(200),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(5000),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

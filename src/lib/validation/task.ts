import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

export const createTaskSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  dueAt: z.coerce.date().optional(),
  assignedToUserId: objectIdSchema.optional(),
  leadId: objectIdSchema.optional(),
  clientId: objectIdSchema.optional(),
  projectId: objectIdSchema.optional(),
  kpiId: objectIdSchema.optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  dueAt: z.coerce.date().nullable().optional(),
  assignedToUserId: objectIdSchema.optional(),
  kpiId: objectIdSchema.nullable().optional(),
});

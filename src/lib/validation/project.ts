import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

export const createProjectSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  assignedDeveloperId: objectIdSchema,
});

export const createProjectTaskSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  assignedDeveloperId: objectIdSchema,
});

export const updateProjectStatusSchema = z.object({
  status: z.enum(["planned", "in_progress", "on_hold", "completed"]),
});

export const updateProjectTaskStatusSchema = z.object({
  status: z.enum(["todo", "in_progress", "blocked", "done"]),
});

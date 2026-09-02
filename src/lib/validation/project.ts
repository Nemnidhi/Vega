import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

export const projectStatusSchema = z.enum([
  "planned",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
]);

export const projectTeamMemberSchema = z.object({
  userId: objectIdSchema,
  role: z.string().trim().max(80).optional(),
});

const projectDatesRefinement = (value: {
  startDate?: Date | null;
  targetEndDate?: Date | null;
}) => !value.startDate || !value.targetEndDate || value.startDate <= value.targetEndDate;

export const createProjectSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).optional(),
    code: z.string().trim().min(2).max(80).optional(),
    status: projectStatusSchema.default("planned"),
    clientId: objectIdSchema.nullable().optional(),
    leadId: objectIdSchema.nullable().optional(),
    scopeManifestId: objectIdSchema.nullable().optional(),
    proposalId: objectIdSchema.nullable().optional(),
    projectManagerId: objectIdSchema.nullable().optional(),
    team: z.array(projectTeamMemberSchema).max(100).default([]),
    startDate: z.coerce.date().nullable().optional(),
    targetEndDate: z.coerce.date().nullable().optional(),
  })
  .refine(projectDatesRefinement, {
    message: "Target end date must be on or after the start date.",
    path: ["targetEndDate"],
  });

export const updateProjectSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    status: projectStatusSchema.optional(),
    clientId: objectIdSchema.nullable().optional(),
    leadId: objectIdSchema.nullable().optional(),
    scopeManifestId: objectIdSchema.nullable().optional(),
    proposalId: objectIdSchema.nullable().optional(),
    projectManagerId: objectIdSchema.nullable().optional(),
    team: z.array(projectTeamMemberSchema).max(100).optional(),
    startDate: z.coerce.date().nullable().optional(),
    targetEndDate: z.coerce.date().nullable().optional(),
  })
  .refine(projectDatesRefinement, {
    message: "Target end date must be on or after the start date.",
    path: ["targetEndDate"],
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const listProjectsQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  clientId: objectIdSchema.optional(),
  includeArchived: z.coerce.boolean().default(false),
});

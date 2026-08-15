import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

const kpiRoleSchema = z.enum([
  "admin",
  "partner",
  "sales",
  "digital_marketing",
  "project_manager",
  "developer",
]);

export const createKpiSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(1000).optional(),
    target: z.number().finite().min(1),
    period: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    assignedRole: kpiRoleSchema.optional(),
    assignedUserId: objectIdSchema.optional(),
  })
  .refine((value) => Boolean(value.assignedRole || value.assignedUserId), {
    message: "A KPI must be assigned to a role, a user, or both.",
    path: ["assignedRole"],
  })
  .refine((value) => value.periodEnd > value.periodStart, {
    message: "periodEnd must be after periodStart.",
    path: ["periodEnd"],
  });

export const updateKpiSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  target: z.number().finite().min(1).optional(),
  period: z.enum(["weekly", "monthly", "quarterly", "yearly"]).optional(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  assignedRole: kpiRoleSchema.nullable().optional(),
  assignedUserId: objectIdSchema.nullable().optional(),
});

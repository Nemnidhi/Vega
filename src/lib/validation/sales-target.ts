import { z } from "zod";
import { objectIdSchema } from "./common";

export const salesTargetValues = z.object({
  metric: z.enum(["revenue", "deals"]),
  period: z.enum(["monthly", "yearly"]),
  periodKey: z.string(),
  target: z.number().finite().positive().max(1_000_000_000_000),
  achieved: z.number().finite().min(0).max(1_000_000_000_000).default(0),
  notes: z.string().trim().max(1000).default(""),
}).superRefine((value, ctx) => {
  const valid = value.period === "monthly" ? /^20\d{2}-(0[1-9]|1[0-2])$/.test(value.periodKey) : /^20\d{2}$/.test(value.periodKey);
  if (!valid) ctx.addIssue({ code: "custom", path: ["periodKey"], message: "Choose a valid month or calendar year (2000–2099)" });
  for (const field of ["target", "achieved"] as const) {
    if (value.metric === "deals" && !Number.isInteger(value[field])) ctx.addIssue({ code: "custom", path: [field], message: "Deal counts must be whole numbers" });
    if (value.metric === "revenue" && Math.abs(value[field] * 100 - Math.round(value[field] * 100)) > 0.001) ctx.addIssue({ code: "custom", path: [field], message: "Revenue supports up to two decimal places" });
  }
});
export const createSalesTargetSchema = z.object({ assignedUserId: objectIdSchema, ...salesTargetValues.shape }).superRefine((value, ctx) => {
  const result = salesTargetValues.safeParse(value);
  if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
});
export const updateSalesTargetSchema = z.object({ ...salesTargetValues.shape, version: z.number().int().min(0) }).superRefine((value, ctx) => {
  const result = salesTargetValues.safeParse(value);
  if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
});

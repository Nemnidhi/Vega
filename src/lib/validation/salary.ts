import { z } from "zod";

export const setBaseSalarySchema = z.object({
  baseSalary: z.number().min(0).max(10_000_000),
});

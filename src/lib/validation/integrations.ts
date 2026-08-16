import { z } from "zod";
import { nonEmptyStringSchema } from "@/lib/validation/common";

export const dashboardEventSchema = z.object({
  dashboardOrganizationId: nonEmptyStringSchema,
  event: nonEmptyStringSchema,
  data: z.record(z.string(), z.unknown()).optional().default({}),
});

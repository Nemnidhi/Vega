import { z } from "zod";
import { nonEmptyStringSchema } from "@/lib/validation/common";

export const dashboardEventSchema = z.object({
  dashboardOrganizationId: nonEmptyStringSchema,
  event: nonEmptyStringSchema,
  data: z.record(z.string(), z.unknown()).optional().default({}),
});

// For a WhatsApp lead booking through Dashboard - no clientUserId (no portal account exists),
// contactPhone identifies the booking instead. Mirrors bookMeetingSchema's shape otherwise.
export const dashboardBookMeetingSchema = z.object({
  contactName: nonEmptyStringSchema,
  contactPhone: nonEmptyStringSchema,
  contactEmail: z.string().trim().email().optional(),
  type: z.enum(["online", "in_person"]),
  dateKey: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  timeKey: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  notes: z.string().trim().max(1000).optional(),
  leadId: z.string().trim().min(1).optional(),
});

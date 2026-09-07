import { z } from "zod";
import { nonEmptyStringSchema } from "@/lib/validation/common";

export const dashboardEventSchema = z.object({
  dashboardOrganizationId: nonEmptyStringSchema,
  event: nonEmptyStringSchema,
  data: z.record(z.string(), z.unknown()).optional().default({}),
});

// A WhatsApp conversation becoming a real lead, not an existing Client's own event feed - see
// dashboard-leads/route.ts for why this is a separate endpoint from dashboard-events above rather
// than another event type there (that route only ever updates an existing Client, never creates
// one; a brand-new lead has no Client yet by definition).
export const dashboardLeadSchema = z.object({
  dashboardOrganizationId: nonEmptyStringSchema,
  conversationId: nonEmptyStringSchema,
  contactName: z.string().trim().max(120).optional(),
  phone: nonEmptyStringSchema,
  campaign: z.string().trim().max(200).optional(),
  ctwaClid: z.string().trim().max(200).optional(),
  firstMessage: z.string().trim().max(2000).optional(),
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

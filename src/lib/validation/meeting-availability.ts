import { z } from "zod";

const weeklyWindowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  endTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
});

export const meetingAvailabilitySchema = z.object({
  weeklyWindows: z.array(weeklyWindowSchema).max(50),
  slotDurationMinutes: z.number().int().min(5).max(480),
  bufferMinutes: z.number().int().min(0).max(240),
  maxConcurrentBookings: z.object({
    online: z.number().int().min(1).max(50),
    in_person: z.number().int().min(1).max(50),
  }),
  bookingWindowDays: z.number().int().min(1).max(90),
  minNoticeHours: z.number().int().min(0).max(240),
  blackoutDates: z
    .array(
      z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    )
    .max(200),
});

export const bookMeetingSchema = z.object({
  clientUserId: z.string().min(1),
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

// A staff member creating a meeting directly from the dashboard (no portal account, no
// Dashboard-WhatsApp integration secret) - the contact may not even be in the system yet (a
// walk-in, a call picked up directly), so this mirrors dashboardBookMeetingSchema's
// enter-the-contact-directly shape rather than bookMeetingSchema's clientUserId lookup. Unlike
// that schema, phone isn't required outright - a staff-entered contact might only have an email
// on hand - but at least one of email/phone must be given or the confirmation email/reminder
// sweep would have nothing to reach them on.
export const staffCreateMeetingSchema = z
  .object({
    contactName: z.string().trim().min(1).max(120),
    contactEmail: z.string().trim().email().optional(),
    contactPhone: z.string().trim().max(30).optional(),
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
  })
  .refine((data) => Boolean(data.contactEmail) || Boolean(data.contactPhone), {
    message: "Provide at least an email or a phone number for the contact.",
    path: ["contactEmail"],
  });

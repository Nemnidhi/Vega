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

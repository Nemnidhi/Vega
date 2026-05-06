import { z } from "zod";

export const leaveTypeValues = [
  "casual",
  "sick",
  "planned",
  "unpaid",
  "other",
] as const;

export const leaveStatusValues = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;

export const reviewableLeaveStatusValues = ["approved", "rejected"] as const;

export const attendanceDayStatusValues = ["present", "absent", "half_day"] as const;

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format");

export const createLeaveRequestSchema = z
  .object({
    leaveType: z.enum(leaveTypeValues),
    startDateKey: dateKeySchema,
    endDateKey: dateKeySchema,
    reason: z.string().trim().max(1000).optional().default(""),
  })
  .refine((value) => value.endDateKey >= value.startDateKey, {
    message: "endDateKey must be greater than or equal to startDateKey",
    path: ["endDateKey"],
  });

export const reviewLeaveRequestSchema = z.object({
  status: z.enum(reviewableLeaveStatusValues),
  reviewNote: z.string().trim().max(500).optional().default(""),
});

export const adminMarkAttendanceSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user id"),
  dateKey: dateKeySchema,
  dayStatus: z.enum(attendanceDayStatusValues),
});

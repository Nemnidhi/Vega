import { z } from "zod";
import { serializeForJson } from "@/lib/utils/serialize";
import { AttendanceSettingsModel } from "@/models";
import { getAttendanceMinutesOfDay, parseTimeOfDayToMinutes } from "@/lib/attendance/date";

// Same document as the office-geofence settings (key: "default") - one attendance-settings row,
// not a second collection.
const ATTENDANCE_SETTINGS_KEY = "default";

export const attendanceLateRuleSchema = z.object({
  shiftStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm, e.g. 10:00."),
  lateGraceMinutes: z.number().int().min(0).max(180),
});

export type AttendanceLateRule = z.infer<typeof attendanceLateRuleSchema>;
export type AttendanceLateRulePayload = AttendanceLateRule & { updatedAt?: string };

// Deliberately returns null rather than a default rule when unconfigured: check-in must never
// start marking people late because of a made-up shift time nobody agreed to. Callers treat null
// as "don't compute lateness" - see resolveCheckInDayStatus below.
export async function getAttendanceLateRule(): Promise<AttendanceLateRulePayload | null> {
  const settings = await AttendanceSettingsModel.findOne({ key: ATTENDANCE_SETTINGS_KEY })
    .select("shiftStartTime lateGraceMinutes updatedAt")
    .lean();

  if (!settings?.shiftStartTime || typeof settings.lateGraceMinutes !== "number") {
    return null;
  }

  return serializeForJson({
    shiftStartTime: settings.shiftStartTime,
    lateGraceMinutes: settings.lateGraceMinutes,
    updatedAt: settings.updatedAt,
  }) as AttendanceLateRulePayload;
}

export async function saveAttendanceLateRule(rule: AttendanceLateRule, updatedByUserId: string) {
  const saved = await AttendanceSettingsModel.findOneAndUpdate(
    { key: ATTENDANCE_SETTINGS_KEY },
    {
      $set: {
        key: ATTENDANCE_SETTINGS_KEY,
        shiftStartTime: rule.shiftStartTime,
        lateGraceMinutes: rule.lateGraceMinutes,
        updatedByUserId,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )
    .select("shiftStartTime lateGraceMinutes updatedAt")
    .lean();

  return serializeForJson({
    shiftStartTime: saved.shiftStartTime,
    lateGraceMinutes: saved.lateGraceMinutes,
    updatedAt: saved.updatedAt,
  }) as AttendanceLateRulePayload;
}

// The single source of truth for "was this check-in late", used at check-in time (route.ts) and by
// the one-off backfill script (scripts/backfill-late-attendance.ts) so the two can never disagree.
export function isCheckInLate(checkInAt: Date, rule: AttendanceLateRule) {
  const cutoffMinutes = parseTimeOfDayToMinutes(rule.shiftStartTime) + rule.lateGraceMinutes;
  return getAttendanceMinutesOfDay(checkInAt) > cutoffMinutes;
}

// Returns the dayStatus a fresh check-in should get. Never returns anything but "present" when no
// rule is configured, so this feature is opt-in and cannot silently start flagging staff as late.
export function resolveCheckInDayStatus(checkInAt: Date, rule: AttendanceLateRule | null) {
  if (!rule) return "present" as const;
  return isCheckInLate(checkInAt, rule) ? ("late_coming" as const) : ("present" as const);
}

/**
 * Creates an "absent" attendance record for every staff member on every past working day that has
 * no record at all - a day nobody checked into, nobody was marked present/late/half-day for, and
 * nobody logged a leave against. Today and any future date are never touched, since the day may
 * not be over yet.
 *
 * This does NOT check the leave-request system, deliberately: the intent is "default to absent,
 * correct it by hand afterwards if leave gets approved for that day" - via the existing Admin >
 * Mark attendance flow, the same one used for every other correction. Building automatic
 * leave-awareness into this script would be a second feature, not this one.
 *
 * Dry-run by default; --apply to write.
 *
 *   npm run mark-empty-days-absent -- --month 2026-08
 *   npm run mark-empty-days-absent -- --month 2026-08 --apply
 *
 * Scope, deliberately narrow:
 *  - Only dates strictly before today (Asia/Kolkata) - never today, never the future.
 *  - Only Monday-Friday - Saturday/Sunday are never marked absent.
 *  - Only staff whose account already existed on that date (createdAt <= that date) - never marks
 *    someone absent for a day before they joined.
 *  - Only genuinely empty entries - if ANY Attendance record already exists for that user+date,
 *    for ANY reason (present, late, half-day, an existing absent mark, anything), it is left alone.
 *    This never overwrites an existing record.
 *  - Fixed-date national holidays (lib/calendar/india-holidays-2026.ts, category "national",
 *    excluding anything flagged isTentative - a moon-sighting festival date can be wrong) are
 *    excluded automatically. This was added after a real near-miss: 2026-08-28 had all 5 staff
 *    empty on the same day - the unmistakable pattern of an office closure, not five coincidental
 *    absences - and it wasn't even on the national list, so it still needed a manual --exclude.
 *    Use --exclude for anything the national list doesn't cover: a company-specific closure, a
 *    tentative festival actually observed this year, etc.
 *
 *   npm run mark-empty-days-absent -- --month 2026-08 --exclude 2026-08-28
 */
import mongoose from "mongoose";
import { AttendanceModel, UserModel } from "@/models";
import { attendanceMemberRoles } from "@/lib/attendance/constants";
import { getAttendanceDateKey, getDateKeysInMonth, isWeekendDateKey } from "@/lib/attendance/date";
import { INDIA_HOLIDAYS_2026 } from "@/lib/calendar/india-holidays-2026";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

function argValue(flag: string) {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : undefined;
}

const MONTH = argValue("--month");
const MANUAL_EXCLUDES = new Set((argValue("--exclude") ?? "").split(",").map((key) => key.trim()).filter(Boolean));
const NATIONAL_HOLIDAY_DATES = new Map(
  INDIA_HOLIDAYS_2026.filter((holiday) => holiday.category === "national" && !holiday.isTentative).map(
    (holiday) => [holiday.dateKey, holiday.name] as const,
  ),
);

async function main() {
  if (!MONTH || !/^\d{4}-\d{2}$/.test(MONTH)) {
    throw new Error('Missing or invalid --month - expected e.g. --month 2026-08.');
  }

  console.log(APPLY ? "MODE: APPLY (will write)" : "MODE: DRY RUN (no writes)");
  console.log(`MONTH: ${MONTH}\n`);

  await mongoose.connect(process.env.MONGODB_URI!, {
    dbName: process.env.MONGODB_DB_NAME!,
    family: 4,
  });

  const todayDateKey = getAttendanceDateKey();
  const staffUsers = await UserModel.find({ role: { $in: attendanceMemberRoles } })
    .select("fullName createdAt")
    .lean();

  const excludedHolidays = getDateKeysInMonth(MONTH).filter((dateKey) => NATIONAL_HOLIDAY_DATES.has(dateKey));
  if (excludedHolidays.length > 0) {
    console.log("auto-excluding national holidays:");
    for (const dateKey of excludedHolidays) console.log(`  ${dateKey}  ${NATIONAL_HOLIDAY_DATES.get(dateKey)}`);
  }
  if (MANUAL_EXCLUDES.size > 0) {
    console.log(`manually excluded via --exclude: ${[...MANUAL_EXCLUDES].join(", ")}`);
  }

  const eligibleDateKeys = getDateKeysInMonth(MONTH).filter(
    (dateKey) =>
      dateKey < todayDateKey &&
      !isWeekendDateKey(dateKey) &&
      !NATIONAL_HOLIDAY_DATES.has(dateKey) &&
      !MANUAL_EXCLUDES.has(dateKey),
  );
  console.log(`\nworking days in scope (past, weekdays, holidays excluded): ${eligibleDateKeys.length}`);
  console.log(`staff: ${staffUsers.length}\n`);

  const existing = await AttendanceModel.find({ dateKey: { $regex: `^${MONTH}` } })
    .select("userId dateKey")
    .lean();
  const existingKeys = new Set(existing.map((record) => `${record.userId}:${record.dateKey}`));

  const candidates: Array<{ userId: string; fullName: string; dateKey: string }> = [];

  for (const user of staffUsers) {
    const joinedDateKey = getAttendanceDateKey(user.createdAt as Date);
    for (const dateKey of eligibleDateKeys) {
      if (dateKey < joinedDateKey) continue; // account didn't exist yet
      if (existingKeys.has(`${user._id}:${dateKey}`)) continue; // not empty - leave it alone
      candidates.push({ userId: String(user._id), fullName: user.fullName, dateKey });
    }
  }

  candidates.sort((a, b) => (a.dateKey === b.dateKey ? a.fullName.localeCompare(b.fullName) : a.dateKey.localeCompare(b.dateKey)));

  console.log(`${candidates.length} empty entr${candidates.length === 1 ? "y" : "ies"} would be marked absent:\n`);
  for (const candidate of candidates) {
    console.log(`  ${candidate.dateKey}  ${candidate.fullName}`);
  }

  if (!APPLY) {
    if (candidates.length > 0) console.log("\nDry run only - re-run with --apply to write these changes.");
    return;
  }

  console.log("\n--- writing ---");
  for (const candidate of candidates) {
    await AttendanceModel.create({
      userId: candidate.userId,
      dateKey: candidate.dateKey,
      dayStatus: "absent",
      checkInAt: null,
      checkOutAt: null,
      workedMinutes: 0,
      totalBreakMinutes: 0,
      breakSessions: [],
      markedByAdminId: null,
      // markedAt is set (unlike a real check-in-derived record) so this is distinguishable later
      // as "auto-defaulted absent" rather than "nobody ever looked at this day" - markedByAdminId
      // stays null because no specific admin made this call.
      markedAt: new Date(),
    });
  }
  console.log(`created ${candidates.length} absent record(s).`);
}

main()
  .catch((error) => {
    console.error("mark-empty-days-absent failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

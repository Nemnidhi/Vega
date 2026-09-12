/**
 * Recomputes dayStatus ("present" vs "late_coming") for this month's attendance records already
 * on disk, against the late rule configured in Settings > Attendance > Late rule.
 *
 * Why this is needed: check-in only started auto-computing lateness once the late rule feature
 * shipped (lib/attendance/late-rule.ts). Every record created before that - including the rest of
 * the current month - has dayStatus "present" regardless of what time the employee actually
 * checked in, because there was nothing to compare it against yet.
 *
 * Dry-run by default; --apply to write.
 *
 *   npm run backfill:late-attendance
 *   npm run backfill:late-attendance -- --apply
 *   npm run backfill:late-attendance -- --month 2026-08 --apply
 *
 * Scope, deliberately narrow:
 *  - Only records with a real checkInAt (an actual check-in happened - never touches
 *    admin-created absent/half_day records, which have no checkInAt at all).
 *  - Only records where markedByAdminId is null - i.e. nobody has manually reviewed and set this
 *    day's status via Admin > Mark attendance. A deliberate admin override always wins; this script
 *    only fills in what nobody has looked at yet. Recomputing over an admin's own judgement call
 *    would be the script overriding a human decision, not backfilling a gap.
 *  - Only recomputes present <-> late_coming. It never touches a record with any other dayStatus.
 */
import mongoose from "mongoose";
import { AttendanceModel } from "@/models";
import { getAttendanceLateRule, resolveCheckInDayStatus } from "@/lib/attendance/late-rule";
import { getAttendanceMonthKey } from "@/lib/attendance/date";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

function argValue(flag: string) {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : undefined;
}

const MONTH = argValue("--month") ?? getAttendanceMonthKey();

async function main() {
  if (!/^\d{4}-\d{2}$/.test(MONTH)) {
    throw new Error(`Invalid --month "${MONTH}" - expected YYYY-MM.`);
  }

  console.log(APPLY ? "MODE: APPLY (will write)" : "MODE: DRY RUN (no writes)");
  console.log(`MONTH: ${MONTH}\n`);

  await mongoose.connect(process.env.MONGODB_URI!, {
    dbName: process.env.MONGODB_DB_NAME!,
    family: 4,
  });

  const rule = await getAttendanceLateRule();
  if (!rule) {
    console.log("No late rule is configured (Settings > Attendance > Late rule). Nothing to backfill against - exiting.");
    return;
  }
  console.log(`Rule: shift start ${rule.shiftStartTime}, grace ${rule.lateGraceMinutes}min (late after ${rule.shiftStartTime} + ${rule.lateGraceMinutes}min)\n`);

  const records = await AttendanceModel.find({
    dateKey: { $regex: `^${MONTH}` },
    checkInAt: { $ne: null },
    markedByAdminId: null,
  })
    .populate("userId", "fullName")
    .select("userId dateKey dayStatus checkInAt markedByAdminId");

  console.log(`candidates (real check-ins, no admin override): ${records.length}`);

  const changes: Array<{ user: string; dateKey: string; checkInAtIst: string; from: string; to: string }> = [];

  for (const record of records) {
    const computed = resolveCheckInDayStatus(record.checkInAt as Date, rule);
    if (computed === record.dayStatus) continue;

    const populatedUser = record.userId as unknown as { fullName?: string } | null;
    changes.push({
      user: populatedUser?.fullName ?? String(record.userId),
      dateKey: record.dateKey,
      checkInAtIst: (record.checkInAt as Date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }),
      from: record.dayStatus,
      to: computed,
    });

    if (APPLY) {
      record.dayStatus = computed;
      await record.save();
    }
  }

  console.log(`\n${changes.length} record(s) ${APPLY ? "changed" : "would change"}:\n`);
  for (const change of changes) {
    console.log(`  ${change.dateKey}  ${change.user.padEnd(24)}  checked in ${change.checkInAtIst} IST  ${change.from} -> ${change.to}`);
  }

  if (!APPLY && changes.length > 0) {
    console.log("\nDry run only - re-run with --apply to write these changes.");
  }
}

main()
  .catch((error) => {
    console.error("backfill-late-attendance failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

/**
 * Reverses the Samvid migration.
 *
 * This is what makes Phase 6 recoverable rather than one-way: every migrated
 * document is tagged with `prospecting.legacyLeadId` (leads) or
 * `legacyLeadId` (reports), so the migration's footprint is exactly
 * identifiable and nothing else is at risk.
 *
 * Dry-run by default. `--apply` deletes.
 *
 *   npm run rollback:samvid
 *   npm run rollback:samvid -- --apply
 *
 * Refuses to touch a lead that has been worked since it was migrated - if
 * someone has moved it down the sales pipeline, attached a client, or sent
 * its report, deleting it would destroy real work. Those are listed and
 * skipped; clear them by hand if the rollback truly must be total.
 */
import mongoose from "mongoose";
import { LeadModel } from "@/models/Lead";
import { ReportModel } from "@/models/Report";
import { ActivityLogModel } from "@/models/ActivityLog";
import type { Lead } from "@/types/lead";

const APPLY = process.argv.includes("--apply");

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main() {
  console.log(APPLY ? "MODE: APPLY (will delete)" : "MODE: DRY RUN (no deletes)");

  await mongoose.connect(required("MONGODB_URI"), { dbName: required("MONGODB_DB_NAME"), family: 4 });
  console.log(`target: ${process.env.MONGODB_DB_NAME}\n`);

  const migrated = await LeadModel.find({ "prospecting.legacyLeadId": { $ne: null } })
    .select("title status clientId ownerId prospecting.legacyLeadId prospecting.prospectingStatus")
    .lean<Lead[]>();

  console.log(`migrated leads found: ${migrated.length}`);
  if (!migrated.length) {
    console.log("Nothing to roll back.");
    await mongoose.disconnect();
    return;
  }

  // Anything that has moved on since migration represents real human work.
  const worked = migrated.filter(
    (lead) =>
      lead.status !== "new" ||
      Boolean(lead.clientId) ||
      lead.prospecting?.prospectingStatus === "sent",
  );
  const safe = migrated.filter((lead) => !worked.includes(lead));

  if (worked.length) {
    console.log(`\nSKIPPING ${worked.length} lead(s) that have been worked since migration:`);
    for (const lead of worked.slice(0, 20)) {
      console.log(
        `  "${lead.title}" - status=${lead.status}, audit=${lead.prospecting?.prospectingStatus}` +
          `${lead.clientId ? ", linked to a client" : ""}`,
      );
    }
    if (worked.length > 20) console.log(`  ... and ${worked.length - 20} more`);
  }

  const safeIds = safe.map((lead) => lead._id);
  const legacyIds = safe.map((lead) => lead.prospecting!.legacyLeadId);

  const reportCount = await ReportModel.countDocuments({ leadId: { $in: safeIds } });
  const logCount = await ActivityLogModel.countDocuments({
    entityType: "lead",
    entityId: { $in: safeIds },
  });

  console.log(`\nwould delete:`);
  console.log(`  ${safe.length} lead(s)`);
  console.log(`  ${reportCount} report(s)`);
  console.log(`  ${logCount} activity-log entr(ies)`);
  console.log(`  legacyLeadId range: ${Math.min(...(legacyIds as number[]))}-${Math.max(...(legacyIds as number[]))}`);

  if (!APPLY) {
    console.log("\nDry run complete - nothing deleted. Re-run with --apply.");
    await mongoose.disconnect();
    return;
  }

  const reports = await ReportModel.deleteMany({ leadId: { $in: safeIds } });
  const logs = await ActivityLogModel.deleteMany({ entityType: "lead", entityId: { $in: safeIds } });
  const leads = await LeadModel.deleteMany({ _id: { $in: safeIds } });

  console.log(
    `\ndeleted leads=${leads.deletedCount} reports=${reports.deletedCount} logs=${logs.deletedCount}`,
  );
  console.log(
    `remaining migrated leads: ${await LeadModel.countDocuments({ "prospecting.legacyLeadId": { $ne: null } })}` +
      (worked.length ? ` (the ${worked.length} worked lead(s) above were kept)` : ""),
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Rollback failed:", error);
  process.exit(1);
});

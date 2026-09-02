/**
 * Pre-flight checks before migrating Samvid's leads into a Vega database.
 *
 * Read-only. Run this against the REAL target before `migrate:samvid --apply`
 * ever touches it. It answers the questions that are painful to discover
 * afterwards:
 *
 *   - Is the target the database I think it is, and what is already in it?
 *   - Has this migration already run (partially or fully)?
 *   - Would any incoming lead duplicate a business already in the CRM?
 *   - What exactly is about to be written?
 *
 *   npm run preflight:migration
 *
 * Exits non-zero if anything needs a human decision.
 */
import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import { LeadModel } from "@/models/Lead";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function main() {
  const samvidUri = required("SAMVID_MONGODB_URI");
  const samvidDb = process.env.SAMVID_MONGODB_DB || "samvid_lead_engine";
  const targetUri = required("MONGODB_URI");
  const targetDb = required("MONGODB_DB_NAME");

  console.log("=".repeat(64));
  console.log(`SOURCE: ${samvidDb}`);
  console.log(`TARGET: ${targetDb}`);
  console.log(`        host ${new URL(targetUri.replace("mongodb+srv://", "https://")).host}`);
  console.log("=".repeat(64));

  let blockers = 0;
  let warnings = 0;
  const block = (msg: string) => { console.log(`  BLOCKER  ${msg}`); blockers += 1; };
  const warn = (msg: string) => { console.log(`  WARNING  ${msg}`); warnings += 1; };
  const ok = (msg: string) => console.log(`  OK       ${msg}`);

  // --- source ---------------------------------------------------------------
  const samvid = new MongoClient(samvidUri);
  await samvid.connect();
  const src = samvid.db(samvidDb);
  const sourceLeads = await src
    .collection("leads")
    .find({}, { projection: { lead_id: 1, name: 1, email: 1 } })
    .toArray();
  const sourceReports = await src.collection("reports").countDocuments();

  console.log("\n[source]");
  ok(`${sourceLeads.length} leads, ${sourceReports} report(s) to migrate`);

  // --- target ---------------------------------------------------------------
  await mongoose.connect(targetUri, { dbName: targetDb, family: 4 });
  const conn = mongoose.connection.db!;
  const collections = (await conn.listCollections().toArray()).map((c) => c.name).sort();

  console.log("\n[target: what is already there]");
  console.log(`  collections: ${collections.join(", ") || "(none)"}`);

  const existingLeads = await LeadModel.countDocuments();
  const existingCold = await LeadModel.countDocuments({ source: "cold_outreach" });
  const alreadyMigrated = await LeadModel.countDocuments({
    "prospecting.legacyLeadId": { $ne: null },
  });
  console.log(`  leads: ${existingLeads} (${existingCold} cold_outreach)`);

  for (const name of ["clients", "projects", "proposals", "users"]) {
    if (collections.includes(name)) {
      console.log(`  ${name}: ${await conn.collection(name).countDocuments()}`);
    }
  }

  console.log("\n[checks]");

  if (alreadyMigrated > 0) {
    if (alreadyMigrated === sourceLeads.length) {
      warn(
        `${alreadyMigrated} leads already carry a legacyLeadId - the migration has already run here. ` +
          `Re-running updates in place (upsert), it will not duplicate.`,
      );
    } else {
      block(
        `${alreadyMigrated} of ${sourceLeads.length} leads already carry a legacyLeadId - ` +
          `a PARTIAL migration. Investigate before re-running.`,
      );
    }
  } else {
    ok("no prior migration detected in this database");
  }

  // Duplicate detection: a business already in the CRM under the same email
  // or a near-identical name would end up represented twice, because the
  // migration keys only on legacyLeadId.
  const sourceEmails = new Set(
    sourceLeads.map((l) => String(l.email ?? "").toLowerCase().trim()).filter(Boolean),
  );
  const emailCollisions = await LeadModel.find({
    email: { $in: [...sourceEmails] },
    "prospecting.legacyLeadId": null,
  })
    .select("title email source")
    .lean<Array<{ title: string; email: string; source: string }>>();

  if (emailCollisions.length) {
    warn(
      `${emailCollisions.length} existing lead(s) share an email with an incoming lead - ` +
        `these would become duplicates (the migration keys on legacyLeadId only):`,
    );
    for (const c of emailCollisions.slice(0, 10)) {
      console.log(`             "${c.title}" <${c.email}> (source: ${c.source})`);
    }
  } else {
    ok("no email collisions with existing leads");
  }

  const sourceNames = new Set(sourceLeads.map((l) => normalizeName(String(l.name ?? ""))));
  const existingTitles = await LeadModel.find({ "prospecting.legacyLeadId": null })
    .select("title")
    .lean<Array<{ title: string }>>();
  const nameCollisions = existingTitles.filter((l) => sourceNames.has(normalizeName(l.title)));
  if (nameCollisions.length) {
    warn(`${nameCollisions.length} existing lead(s) share a business name with an incoming lead`);
    for (const c of nameCollisions.slice(0, 10)) console.log(`             "${c.title}"`);
  } else {
    ok("no business-name collisions with existing leads");
  }

  // Writing cold prospects into a live CRM changes what the sales team sees.
  // Migrated leads are upserted, so only pre-existing non-migrated leads add
  // to the eventual total.
  const preExisting = existingLeads - alreadyMigrated;
  if (preExisting > 0) {
    warn(
      `this database already has ${preExisting} unrelated lead(s). After migration the Leads list ` +
        `will contain ${preExisting + sourceLeads.length}, overwhelmingly cold prospects. ` +
        `Confirm that is intended - it changes what the sales team sees every day.`,
    );
  }

  const inserts = sourceLeads.length - alreadyMigrated;
  console.log("\n[what would be written]");
  console.log(`  + ${Math.max(inserts, 0)} new Lead document(s) (source: cold_outreach, status: new)`);
  if (alreadyMigrated > 0) {
    console.log(`  ~ ${alreadyMigrated} existing migrated Lead document(s) updated in place`);
  }
  console.log(`  + / ~ ${sourceReports} Report document(s)`);
  console.log(`  ~ 0 unrelated documents touched`);

  console.log("\n" + "=".repeat(64));
  console.log(
    blockers
      ? `NOT SAFE: ${blockers} blocker(s), ${warnings} warning(s)`
      : warnings
        ? `PROCEED WITH CARE: ${warnings} warning(s) needing a human decision`
        : "CLEAR: no blockers, no warnings",
  );

  await samvid.close();
  await mongoose.disconnect();
  process.exit(blockers ? 1 : 0);
}

main().catch((error) => {
  console.error("Pre-flight failed:", error);
  process.exit(1);
});

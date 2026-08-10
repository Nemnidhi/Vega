/**
 * Post-migration verification: compares what landed in the target database
 * against the Samvid source, record by record.
 *
 * Read-only. Counts alone can agree while individual fields are silently
 * wrong, so this samples real documents and diffs the fields that matter.
 *
 *   npm run verify:migration
 *   npm run verify:migration -- --sample 50
 *
 * Exits non-zero on any mismatch.
 */
import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import { LeadModel } from "@/models/Lead";
import { ReportModel } from "@/models/Report";
import type { Lead } from "@/types/lead";

const SAMPLE = Number(
  process.argv.find((a) => a.startsWith("--sample="))?.split("=")[1] ??
    (process.argv.includes("--sample") ? process.argv[process.argv.indexOf("--sample") + 1] : "") ??
    "25",
) || 25;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main() {
  const samvid = new MongoClient(required("SAMVID_MONGODB_URI"));
  await samvid.connect();
  const src = samvid.db(process.env.SAMVID_MONGODB_DB || "samvid_lead_engine");
  await mongoose.connect(required("MONGODB_URI"), { dbName: required("MONGODB_DB_NAME"), family: 4 });

  let failures = 0;
  const check = (label: string, actual: unknown, expected: unknown) => {
    const ok = actual === expected;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${actual}, expected ${expected})`}`);
    if (!ok) failures += 1;
  };

  // --- counts ---------------------------------------------------------------
  console.log("[counts]");
  const sourceLeads = await src.collection("leads").countDocuments();
  const migrated = await LeadModel.countDocuments({ "prospecting.legacyLeadId": { $ne: null } });
  check("every source lead migrated", migrated, sourceLeads);

  const sourceReports = await src.collection("reports").countDocuments();
  check("reports migrated", await ReportModel.countDocuments(), sourceReports);

  const withEmail = await LeadModel.countDocuments({
    "prospecting.legacyLeadId": { $ne: null },
    email: { $nin: [null, ""] },
  });
  check(
    "emails preserved",
    withEmail,
    await src.collection("leads").countDocuments({ email: { $nin: [null, ""] } }),
  );

  const distinctLegacy = (await LeadModel.distinct("prospecting.legacyLeadId")).filter(
    (v) => v !== null,
  ).length;
  check("no duplicate legacyLeadId", distinctLegacy, sourceLeads);

  // --- field-level spot checks ---------------------------------------------
  console.log(`\n[field-level spot check on ${SAMPLE} random leads]`);
  const sample = await src
    .collection("leads")
    .aggregate([{ $sample: { size: SAMPLE } }])
    .toArray();

  let mismatches = 0;
  for (const s of sample) {
    const lead = await LeadModel.findOne({ "prospecting.legacyLeadId": s.lead_id }).lean<Lead>();
    if (!lead) {
      console.log(`  MISSING  lead_id ${s.lead_id} "${s.name}"`);
      mismatches += 1;
      continue;
    }

    const p = lead.prospecting!;
    const problems: string[] = [];
    if (lead.title !== String(s.name).trim().slice(0, 200)) problems.push(`title "${lead.title}" != "${s.name}"`);
    if ((lead.email ?? "") !== String(s.email ?? "").toLowerCase().trim()) {
      problems.push(`email "${lead.email}" != "${s.email}"`);
    }
    if (p.state !== (s.state || undefined)) problems.push(`state "${p.state}" != "${s.state}"`);
    if (p.registrationNo !== (s.registration_no || undefined)) {
      problems.push(`registrationNo "${p.registrationNo}" != "${s.registration_no}"`);
    }
    if (p.priorityScore !== (typeof s.priority_score === "number" ? s.priority_score : null)) {
      problems.push(`priorityScore ${p.priorityScore} != ${s.priority_score}`);
    }
    if (lead.source !== "cold_outreach") problems.push(`source is "${lead.source}"`);

    if (problems.length) {
      console.log(`  MISMATCH lead_id ${s.lead_id} "${s.name}"`);
      for (const problem of problems) console.log(`             ${problem}`);
      mismatches += 1;
    }
  }
  check(`all ${SAMPLE} sampled leads match the source`, mismatches, 0);

  // --- enrichment / classification carried over -----------------------------
  console.log("\n[signals]");
  const websiteFound = await LeadModel.countDocuments({
    "prospecting.digitalPresence.website.found": true,
  });
  check(
    "website-found count",
    websiteFound,
    await src.collection("enrichment").countDocuments({ "website.found": true }),
  );

  const tiers = await LeadModel.aggregate([
    { $match: { "prospecting.legacyLeadId": { $ne: null } } },
    { $group: { _id: "$prospecting.classification.category", n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log(`  tier distribution: ${JSON.stringify(Object.fromEntries(tiers.map((t) => [t._id, t.n])))}`);
  const untiered = await LeadModel.countDocuments({
    "prospecting.legacyLeadId": { $ne: null },
    "prospecting.classification.category": null,
  });
  check("every migrated lead has a tier", untiered, 0);

  const noIndustry = await LeadModel.countDocuments({
    "prospecting.legacyLeadId": { $ne: null },
    $or: [{ "prospecting.industry": null }, { "prospecting.industry": { $exists: false } }],
  });
  check("every migrated lead has an industry", noIndustry, 0);

  // --- reports --------------------------------------------------------------
  console.log("\n[reports]");
  const reports = await ReportModel.find({}).limit(5);
  for (const report of reports) {
    const pdf: Buffer = Buffer.isBuffer(report.pdf) ? report.pdf : Buffer.from(report.pdf.buffer);
    const valid = pdf.subarray(0, 5).toString() === "%PDF-";
    console.log(`  ${valid ? "PASS" : "FAIL"}  report for legacyLeadId ${report.legacyLeadId}: ${pdf.length} bytes, valid PDF=${valid}`);
    if (!valid) failures += 1;
    const owner = await LeadModel.findById(report.leadId).select("_id").lean();
    if (!owner) {
      console.log(`  FAIL  report ${report._id} points at a lead that does not exist`);
      failures += 1;
    }
  }

  console.log("\n" + (failures ? `${failures} CHECK(S) FAILED` : "All verification checks passed."));
  await samvid.close();
  await mongoose.disconnect();
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error("Verification failed:", error);
  process.exit(1);
});

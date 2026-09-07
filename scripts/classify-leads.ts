/**
 * Classifies enriched leads into tiers A/B/C/D using the rule-based engine
 * in lib/prospecting/classify.ts.
 *
 * Safe to re-run: already-classified leads are skipped unless --reclassify
 * is passed, so re-running after a Google/Meta backfill can upgrade earlier
 * "partial confidence" classifications.
 *
 *   npm run classify:leads
 *   npm run classify:leads -- 200 --reclassify
 *
 * Ported from Samvid's scripts/classify-leads.js, against the unified Lead
 * model rather than three parallel collections.
 */
import mongoose from "mongoose";
import { LeadModel } from "@/models/Lead";
import { ActivityLogModel } from "@/models/ActivityLog";
import { classify } from "@/lib/prospecting/classify";
import { toEnrichmentSignals } from "@/lib/prospecting/lead-adapter";
import type { Lead, ProspectingTier } from "@/types/lead";

const args = process.argv.slice(2);
const RECLASSIFY = args.includes("--reclassify");
const BATCH_SIZE = Number(
  args.find((a) => !a.startsWith("--")) || process.env.CLASSIFY_BATCH_SIZE || "50",
);

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main() {
  if (!Number.isFinite(BATCH_SIZE) || BATCH_SIZE < 1) {
    throw new Error(`Invalid batch size: ${BATCH_SIZE}`);
  }

  await mongoose.connect(required("MONGODB_URI"), {
    dbName: required("MONGODB_DB_NAME"),
    family: 4,
  });

  // Never re-touch a lead whose report has already gone out - reclassifying
  // under it would leave the tier disagreeing with the PDF the business has.
  const statuses = RECLASSIFY ? ["enriched", "classified"] : ["enriched"];
  const batch = await LeadModel.find({
    source: "cold_outreach",
    "prospecting.prospectingStatus": { $in: statuses },
  })
    .sort({ "prospecting.priorityScore": -1, createdAt: 1 })
    .limit(BATCH_SIZE)
    .lean<Lead[]>();

  console.log(
    `Fetched ${batch.length} lead(s) to classify (batch size ${BATCH_SIZE}, reclassify=${RECLASSIFY})`,
  );

  const tally: Record<ProspectingTier, number> = { A: 0, B: 0, C: 0, D: 0 };
  let processed = 0;
  let skippedNoEnrichment = 0;
  const changed: Array<{ title: string; from?: string; to: string }> = [];

  for (const lead of batch) {
    const signals = toEnrichmentSignals(lead);
    if (!Object.keys(signals).length) {
      skippedNoEnrichment += 1;
      console.warn(`  ${lead.title}: no enrichment signals, skipping`);
      continue;
    }

    const previous = lead.prospecting?.classification?.category;
    const result = classify(signals);

    await LeadModel.updateOne(
      { _id: lead._id },
      {
        $set: {
          "prospecting.prospectingStatus": "classified",
          "prospecting.classification": {
            category: result.category,
            confidence: result.confidence,
            signalsChecked: result.signalsChecked,
            signalsFound: result.signalsFound,
            reasoning: result.reasoning,
            classifiedAt: new Date(),
          },
        },
      },
    );

    await ActivityLogModel.create({
      action: "audit_classification_completed",
      entityType: "lead",
      entityId: lead._id,
      details: { from: previous ?? null, to: result.category, confidence: result.confidence },
    });

    tally[result.category] += 1;
    processed += 1;
    if (previous && previous !== result.category) {
      changed.push({ title: lead.title, from: previous, to: result.category });
    }
    console.log(`  ${lead.title}: ${result.category} (${result.confidence}) - ${result.reasoning}`);
  }

  console.log(
    `Done. Processed: ${processed}, skipped (no enrichment): ${skippedNoEnrichment}, ` +
      `tally: A=${tally.A} B=${tally.B} C=${tally.C} D=${tally.D}`,
  );
  if (changed.length) {
    console.log(`Tier changed for ${changed.length} lead(s):`);
    for (const c of changed.slice(0, 20)) console.log(`  ${c.from} -> ${c.to}  ${c.title}`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Classification run failed:", error);
  process.exit(1);
});

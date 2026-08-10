/**
 * Resolves `prospecting.industry` / `segment` for leads already in the
 * database.
 *
 * Industry is normally decided at ingestion. This exists for the two cases
 * where that isn't enough: leads imported before industry resolution
 * existed, and re-running after the keyword map in resolve-industry.ts
 * improves.
 *
 * Dry-run by default; --apply to write.
 *
 *   npm run backfill:industry
 *   npm run backfill:industry -- --apply
 *   npm run backfill:industry -- --apply --all   (re-resolve, incl. already-set)
 *
 * By default only touches leads with no industry. `--all` re-resolves
 * everything except leads whose industry was set explicitly by a source -
 * a human-or-source-stated sector always outranks a keyword guess.
 */
import mongoose from "mongoose";
import { LeadModel } from "@/models/Lead";
import { resolveProspectIndustry } from "@/lib/prospecting/resolve-industry";
import type { Lead } from "@/types/lead";

const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");

async function main() {
  console.log(APPLY ? "MODE: APPLY (will write)" : "MODE: DRY RUN (no writes)");
  console.log(ALL ? "SCOPE: all non-explicit leads" : "SCOPE: leads with no industry yet\n");

  await mongoose.connect(process.env.MONGODB_URI!, {
    dbName: process.env.MONGODB_DB_NAME!,
    family: 4,
  });

  const filter = ALL
    ? { "prospecting.industryConfidence": { $ne: "explicit" } }
    : { $or: [{ "prospecting.industry": { $exists: false } }, { "prospecting.industry": null }] };

  const leads = await LeadModel.find(filter).lean<Lead[]>();
  console.log(`candidates: ${leads.length}`);

  const before: Record<string, number> = {};
  const after: Record<string, number> = {};
  const confidence: Record<string, number> = {};
  const changes: Array<{ id: string; title: string; from: string; to: string; why: string }> = [];

  for (const lead of leads) {
    const p = lead.prospecting;
    const fromKey = p?.industry ?? "(none)";
    before[fromKey] = (before[fromKey] ?? 0) + 1;

    const resolved = resolveProspectIndustry({
      industryLabel: p?.industry ?? null,
      businessCategory: p?.businessCategory ?? null,
      registrationNo: p?.registrationNo ?? null,
      entityType: p?.entityType ?? null,
      name: lead.title,
      description: lead.description ?? null,
    });

    const toKey = resolved.industry ?? "(unresolved)";
    after[toKey] = (after[toKey] ?? 0) + 1;
    confidence[resolved.confidence] = (confidence[resolved.confidence] ?? 0) + 1;

    if (fromKey !== toKey) {
      changes.push({
        id: String(lead._id),
        title: lead.title,
        from: fromKey,
        to: toKey,
        why: resolved.matchedOn ?? "-",
      });
    }

    if (APPLY) {
      await LeadModel.updateOne(
        { _id: lead._id },
        {
          $set: {
            "prospecting.industry": resolved.industry ?? null,
            "prospecting.segment": resolved.segment ?? null,
            "prospecting.industryConfidence": resolved.confidence,
            "prospecting.industryMatchedOn": resolved.matchedOn,
            "prospecting.unmappedIndustryLabel": resolved.unmappedLabel ?? null,
          },
        },
      );
    }
  }

  console.log("\nresolved industry distribution:");
  for (const [industry, n] of Object.entries(after).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${industry}`);
  }
  console.log("confidence:", JSON.stringify(confidence));
  console.log(`\nwould change: ${changes.length}`);
  for (const c of changes.slice(0, 15)) {
    console.log(`  ${c.from} -> ${c.to}   (${c.why})   ${c.title.slice(0, 50)}`);
  }
  if (changes.length > 15) console.log(`  ... and ${changes.length - 15} more`);

  if (!APPLY) console.log("\nDry run complete - nothing written.");
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});

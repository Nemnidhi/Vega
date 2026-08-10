/**
 * Re-applies the business-name check to Google results that were stored
 * before the check existed.
 *
 * Runs entirely offline: the listing name is already on the lead, so no
 * Places API calls (and no quota) are needed. Leads whose stored result
 * fails the name check flip to `found: false`, which usually means their
 * tier should be recomputed - follow up with:
 *
 *   npm run classify:leads -- 2000 --reclassify
 *
 * Dry-run by default; --apply to write.
 *
 *   npm run recheck:google
 *   npm run recheck:google -- --apply
 */
import mongoose from "mongoose";
import { LeadModel } from "@/models/Lead";
import { compareBusinessNames } from "@/lib/prospecting/name-similarity";
import type { Lead } from "@/types/lead";

const APPLY = process.argv.includes("--apply");

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main() {
  console.log(APPLY ? "MODE: APPLY (will write)" : "MODE: DRY RUN (no writes)");

  await mongoose.connect(required("MONGODB_URI"), { dbName: required("MONGODB_DB_NAME"), family: 4 });

  // Leads currently credited with a listing, PLUS ones this check itself
  // rejected - so an improved comparator can restore them (adding
  // abbreviation matching rescued 59, including "JONES LANG LASALLE ..." ->
  // "JLL Ahmedabad").
  //
  // Deliberately NOT every lead with a stored listing name: a `found:false`
  // can also mean the top result was CLOSED_PERMANENTLY, and Samvid never
  // stored business_status, so those are indistinguishable here. Including
  // them resurrects permanently-closed businesses.
  const leads = await LeadModel.find({
    "prospecting.digitalPresence.googleBusiness.checked": true,
    "prospecting.digitalPresence.googleBusiness.placeName": { $nin: [null, ""] },
    $or: [
      { "prospecting.digitalPresence.googleBusiness.found": true },
      { "prospecting.digitalPresence.googleBusiness.nameMatch": "weak" },
    ],
  })
    .select("title prospecting.digitalPresence.googleBusiness")
    .lean<Lead[]>();

  console.log(`candidates (credited, or previously rejected by this check): ${leads.length}`);

  const tally: Record<string, number> = { strong: 0, weak: 0, unverifiable: 0, noPlaceName: 0 };
  const flipped: Array<{ title: string; placeName: string; score: number | null }> = [];
  const restored: Array<{ title: string; placeName: string; score: number | null }> = [];

  for (const lead of leads) {
    const g = lead.prospecting?.digitalPresence?.googleBusiness;
    if (!g?.placeName) {
      tally.noPlaceName += 1;
      continue;
    }

    const match = compareBusinessNames(lead.title, g.placeName);
    tally[match.verdict] += 1;

    const found = match.verdict !== "weak";
    const was = g.found === true;
    if (!found && was) flipped.push({ title: lead.title, placeName: g.placeName, score: match.score });
    if (found && !was) restored.push({ title: lead.title, placeName: g.placeName, score: match.score });

    if (APPLY) {
      await LeadModel.updateOne(
        { _id: lead._id },
        {
          $set: {
            "prospecting.digitalPresence.googleBusiness.found": found,
            "prospecting.digitalPresence.googleBusiness.nameMatch": match.verdict,
            "prospecting.digitalPresence.googleBusiness.nameSimilarity": match.score,
            ...(found
              ? {}
              : {
                  "prospecting.digitalPresence.googleBusiness.rating": null,
                  "prospecting.digitalPresence.googleBusiness.reviewCount": null,
                  "prospecting.digitalPresence.googleBusiness.reason": `top result "${g.placeName}" does not match the business name (similarity ${match.score?.toFixed(2)})`,
                }),
          },
        },
      );
    }
  }

  console.log(`\nverdicts: ${JSON.stringify(tally)}`);
  console.log(`flip to not-found: ${flipped.length}`);
  for (const f of flipped.slice(0, 12)) {
    console.log(`  ${f.score?.toFixed(2)}  "${f.title}"  ->  "${f.placeName}"`);
  }
  if (flipped.length > 12) console.log(`  ... and ${flipped.length - 12} more`);

  if (restored.length) {
    console.log(`\nrestored to found (comparator improved): ${restored.length}`);
    for (const r of restored.slice(0, 12)) {
      console.log(`  ${r.score?.toFixed(2)}  "${r.title}"  ->  "${r.placeName}"`);
    }
  }

  console.log(
    APPLY
      ? "\nDone. Re-run classification: npm run classify:leads -- 2000 --reclassify"
      : "\nDry run complete - nothing written.",
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Recheck failed:", error);
  process.exit(1);
});

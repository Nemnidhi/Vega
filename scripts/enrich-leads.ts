/**
 * Enrichment worker: picks up cold prospects that haven't been checked yet,
 * probes their digital presence, and writes the result onto the lead.
 *
 * Ported from Samvid's scripts/enrich-leads.js. The three-collection layout
 * there (leads + enrichment + classification) is gone - everything lives on
 * `prospecting` on the one Lead document now.
 *
 * Designed to run as a scheduled GitHub Action, not a Vercel function: it
 * loops over many leads and would exceed serverless timeouts.
 *
 *   npm run enrich:leads               # default batch
 *   npm run enrich:leads -- 25         # explicit batch size
 *   npm run enrich:leads -- 50 --regoogle
 *
 * --regoogle re-runs ONLY the Google Business check for leads whose
 * googleBusiness.checked is still false (e.g. enriched before the API key
 * existed). It leaves website/meta and the prospecting status untouched -
 * follow up with `classify-leads --reclassify` afterwards.
 */
import mongoose from "mongoose";
import { LeadModel } from "@/models/Lead";
import { ActivityLogModel } from "@/models/ActivityLog";
import { checkWebsite } from "@/lib/prospecting/check-website";
import { checkGoogleBusiness } from "@/lib/prospecting/check-google-business";
import { checkMetaAds } from "@/lib/prospecting/check-meta-ads";
import type { Lead } from "@/types/lead";

const args = process.argv.slice(2);
const REGOOGLE = args.includes("--regoogle");
const BATCH_SIZE = Number(
  args.find((a) => !a.startsWith("--")) || process.env.ENRICHMENT_BATCH_SIZE || "10",
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

  let processed = 0;
  let failed = 0;
  const websiteFound = { yes: 0, no: 0 };
  const googleFound = { yes: 0, no: 0 };

  if (REGOOGLE) {
    const batch = await LeadModel.find({
      "prospecting.digitalPresence.googleBusiness.checked": false,
    })
      .sort({ "prospecting.priorityScore": -1 })
      .limit(BATCH_SIZE)
      .lean<Lead[]>();

    console.log(`Re-checking Google Business for ${batch.length} lead(s) (batch size ${BATCH_SIZE})`);

    for (const lead of batch) {
      try {
        const googleBusiness = await checkGoogleBusiness(
          lead.title,
          lead.prospecting?.district,
          lead.prospecting?.state,
        );
        await LeadModel.updateOne(
          { _id: lead._id },
          { $set: { "prospecting.digitalPresence.googleBusiness": googleBusiness } },
        );
        processed += 1;
        if (googleBusiness.checked) googleFound[googleBusiness.found ? "yes" : "no"] += 1;
        console.log(
          `  ${lead.title}: google_business=${
            googleBusiness.checked ? (googleBusiness.found ? "found" : "not found") : "still not checked"
          }`,
        );
      } catch (error) {
        failed += 1;
        console.error(`  ${lead.title} failed:`, error);
      }
    }

    console.log(
      `Done. Processed: ${processed}, failed: ${failed}, google found: ${googleFound.yes}, not found: ${googleFound.no}`,
    );
    await mongoose.disconnect();
    return;
  }

  // Only cold prospects are audited, and only ones not yet enriched.
  const batch = await LeadModel.find({
    source: "cold_outreach",
    "prospecting.prospectingStatus": "new",
  })
    .sort({ "prospecting.priorityScore": -1, createdAt: 1 })
    .limit(BATCH_SIZE)
    .lean<Lead[]>();

  console.log(`Fetched ${batch.length} un-enriched lead(s) (batch size ${BATCH_SIZE})`);

  for (const lead of batch) {
    try {
      // One failing checker must not lose the other two results.
      const [website, googleBusiness, metaAds] = await Promise.all([
        checkWebsite(lead.title).catch((error) => ({
          found: false,
          url: null,
          checkedAt: new Date(),
          note: String(error),
        })),
        checkGoogleBusiness(lead.title, lead.prospecting?.district, lead.prospecting?.state).catch(
          (error) => ({
            checked: false,
            found: null,
            rating: null,
            reviewCount: null,
            reason: String(error),
            checkedAt: new Date(),
          }),
        ),
        checkMetaAds(lead.title).catch((error) => ({
          checked: false,
          found: null,
          activeCount: null,
          reason: String(error),
          checkedAt: new Date(),
        })),
      ]);

      await LeadModel.updateOne(
        { _id: lead._id },
        {
          $set: {
            "prospecting.digitalPresence.website": website,
            "prospecting.digitalPresence.googleBusiness": googleBusiness,
            "prospecting.digitalPresence.metaAds": metaAds,
            "prospecting.prospectingStatus": "enriched",
          },
        },
      );

      // actorId omitted on purpose - this runs unattended, with no human actor.
      await ActivityLogModel.create({
        action: "audit_enrichment_completed",
        entityType: "lead",
        entityId: lead._id,
        details: {
          website: website.found,
          googleBusiness: googleBusiness.checked ? googleBusiness.found : "not_checked",
          metaAds: metaAds.checked ? metaAds.found : "not_checked",
        },
      });

      processed += 1;
      websiteFound[website.found ? "yes" : "no"] += 1;
      if (googleBusiness.checked) googleFound[googleBusiness.found ? "yes" : "no"] += 1;
      console.log(
        `  ${lead.title}: website=${website.found ? "found" : "not found"}, google=${
          googleBusiness.checked ? (googleBusiness.found ? "found" : "not found") : "not checked"
        }`,
      );
    } catch (error) {
      failed += 1;
      console.error(`  ${lead.title} failed:`, error);
    }
  }

  console.log(
    `Done. Processed: ${processed}, failed: ${failed}, websites found: ${websiteFound.yes}, not found: ${websiteFound.no}`,
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Enrichment run failed:", error);
  process.exit(1);
});

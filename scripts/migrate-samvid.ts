/**
 * One-time migration: Samvid Lead Engine -> Vega's unified Lead model.
 *
 * Reads Samvid's `leads` + `enrichment` + `classification` + `reports`
 * collections and writes unified `Lead` and `Report` documents into Vega's
 * database. The Samvid database is only ever read from.
 *
 * Dry-run by default - prints what it *would* write and exits without
 * touching the target. Pass --apply to actually write.
 *
 *   npm run migrate:samvid            # dry run
 *   npm run migrate:samvid -- --apply # for real
 *
 * Idempotent: upserts keyed on `prospecting.legacyLeadId`, so re-running
 * updates the same documents rather than duplicating them.
 *
 * Requires SAMVID_MONGODB_URI and SAMVID_MONGODB_DB in the environment,
 * alongside Vega's own MONGODB_URI / MONGODB_DB_NAME.
 */
import mongoose from "mongoose";
import { MongoClient, type Binary } from "mongodb";
import { LeadModel } from "@/models/Lead";
import { ReportModel } from "@/models/Report";
import { scoreLead } from "@/lib/leads/scoring";
import { resolveProspectIndustry } from "@/lib/prospecting/resolve-industry";
import type { ProspectingStatus, ProspectingTier } from "@/types/lead";

const APPLY = process.argv.includes("--apply");

/**
 * Sector of the source dataset as a whole.
 *
 * Every one of Samvid's leads was scraped from a state RERA *agent* registry,
 * so the sector is a fact about the source, not something to be guessed
 * per-row. That distinction matters: registration formats differ by state
 * (only Chhattisgarh's contains the literal string "RERA" - Rajasthan uses
 * `RAJ/A/2017/001`, MP uses `A-IND-24-1779`), and guessing from company
 * names misfiled ~49 of these as construction / professional services / IT.
 *
 * Override with --industry=<key>, or --industry=none to fall back to
 * per-row inference.
 */
const SOURCE_INDUSTRY = (() => {
  const arg = process.argv.find((a) => a.startsWith("--industry="));
  const value = arg?.split("=")[1];
  if (value === "none") return null;
  return value || "real_estate";
})();

type SamvidLead = {
  lead_id: number;
  name?: string;
  email?: string;
  phone?: string;
  state?: string;
  district?: string;
  agent_type?: string;
  registration_no?: string;
  priority_score?: number;
  priority_tier?: string;
  status?: string;
  industry?: string;
  segment?: string;
  business_category?: string;
};

type SamvidEnrichment = {
  lead_id: number;
  website?: { found?: boolean; url?: string | null; checked_at?: Date };
  google_business?: {
    checked?: boolean;
    found?: boolean | null;
    rating?: number | null;
    review_count?: number | null;
    place_name?: string | null;
    checked_at?: Date;
  };
  meta_ads?: {
    checked?: boolean;
    found?: boolean | null;
    active_count?: number | null;
    checked_at?: Date;
  };
};

type SamvidClassification = {
  lead_id: number;
  category?: ProspectingTier;
  confidence?: "partial" | "full";
  signals_checked?: number;
  signals_found?: number;
  reasoning?: string;
  classified_at?: Date;
};

type SamvidReport = {
  lead_id: number;
  pdf?: Binary;
  category_used?: ProspectingTier;
  paragraph_source?: string;
  generated_at?: Date;
};

const PROSPECTING_STATUSES: ProspectingStatus[] = [
  "new",
  "enriched",
  "classified",
  "reported",
  "sent",
];

function toProspectingStatus(value?: string): ProspectingStatus {
  return PROSPECTING_STATUSES.includes(value as ProspectingStatus)
    ? (value as ProspectingStatus)
    : "new";
}

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Set it in .env.local.`);
  }
  return value;
}

function trimTo(value: string | undefined, max: number) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

async function main() {
  const samvidUri = required("SAMVID_MONGODB_URI");
  const samvidDb = process.env.SAMVID_MONGODB_DB || "samvid_lead_engine";
  const vegaUri = required("MONGODB_URI");
  const vegaDb = required("MONGODB_DB_NAME");

  console.log(APPLY ? "MODE: APPLY (will write)" : "MODE: DRY RUN (no writes)");
  console.log(`source: ${samvidDb}  ->  target: ${vegaDb}`);
  console.log(`source sector: ${SOURCE_INDUSTRY ?? "(per-row inference)"}\n`);

  const samvidClient = new MongoClient(samvidUri);
  await samvidClient.connect();
  const source = samvidClient.db(samvidDb);

  const [leads, enrichments, classifications, reports] = await Promise.all([
    source.collection<SamvidLead>("leads").find({}).toArray(),
    source.collection<SamvidEnrichment>("enrichment").find({}).toArray(),
    source.collection<SamvidClassification>("classification").find({}).toArray(),
    source.collection<SamvidReport>("reports").find({}).toArray(),
  ]);

  const enrichmentBy = new Map(enrichments.map((doc) => [doc.lead_id, doc]));
  const classificationBy = new Map(classifications.map((doc) => [doc.lead_id, doc]));

  console.log(
    `read  leads=${leads.length} enrichment=${enrichments.length} ` +
      `classification=${classifications.length} reports=${reports.length}`,
  );

  const skipped: Array<{ leadId: number; reason: string }> = [];
  const prepared: Array<{ legacyLeadId: number; doc: Record<string, unknown> }> = [];
  const tierCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const industryCounts: Record<string, number> = {};
  const confidenceCounts: Record<string, number> = {};
  const segmentCounts: Record<string, number> = {};
  let googleFound = 0;
  let websiteFound = 0;

  for (const lead of leads) {
    const title = trimTo(lead.name, 200);
    if (!title || title.length < 3) {
      skipped.push({ leadId: lead.lead_id, reason: `unusable name: ${JSON.stringify(lead.name)}` });
      continue;
    }

    const enrichment = enrichmentBy.get(lead.lead_id);
    const classification = classificationBy.get(lead.lead_id);
    const website = enrichment?.website;
    const google = enrichment?.google_business;
    const meta = enrichment?.meta_ads;

    if (google?.found) googleFound += 1;
    if (website?.found) websiteFound += 1;

    const tier = classification?.category;
    if (tier) tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;

    const prospectingStatus = toProspectingStatus(lead.status);
    statusCounts[prospectingStatus] = (statusCounts[prospectingStatus] ?? 0) + 1;

    // Cold prospects carry no category/urgency/budget, so this always lands in
    // the volume pipeline. That is correct: Vega's score measures how good a
    // deal is for us, which an unqualified cold prospect has not yet shown.
    const scoring = scoreLead({ source: "cold_outreach" });

    // Samvid never stored an industry. The sector comes from the source
    // dataset (see SOURCE_INDUSTRY); the *segment* - developer vs broker -
    // is still resolved per lead from its own entity type and name.
    const resolved = resolveProspectIndustry({
      industryLabel: lead.industry || SOURCE_INDUSTRY,
      businessCategory: lead.business_category,
      registrationNo: lead.registration_no,
      entityType: lead.agent_type,
      name: lead.name,
    });
    industryCounts[resolved.industry ?? "(unresolved)"] =
      (industryCounts[resolved.industry ?? "(unresolved)"] ?? 0) + 1;
    confidenceCounts[resolved.confidence] = (confidenceCounts[resolved.confidence] ?? 0) + 1;
    segmentCounts[resolved.segment ?? "(none)"] = (segmentCounts[resolved.segment ?? "(none)"] ?? 0) + 1;

    prepared.push({
      legacyLeadId: lead.lead_id,
      doc: {
        title,
        email: trimTo(lead.email, 180)?.toLowerCase(),
        phone: trimTo(lead.phone, 30),
        source: "cold_outreach",
        status: "new",
        tags: [],
        ...scoring,
        prospecting: {
          legacyLeadId: lead.lead_id,
          industry: resolved.industry ?? undefined,
          segment: resolved.segment ?? undefined,
          industryConfidence: resolved.confidence,
          industryMatchedOn: resolved.matchedOn,
          unmappedIndustryLabel: resolved.unmappedLabel ?? null,
          businessCategory: trimTo(lead.business_category, 300),
          state: trimTo(lead.state, 100),
          district: trimTo(lead.district, 100),
          entityType: trimTo(lead.agent_type, 100),
          registrationNo: trimTo(lead.registration_no, 100),
          priorityScore: typeof lead.priority_score === "number" ? lead.priority_score : null,
          priorityTier: trimTo(lead.priority_tier, 40),
          prospectingStatus,
          digitalPresence: {
            website: website
              ? {
                  found: Boolean(website.found),
                  url: website.url ?? null,
                  checkedAt: website.checked_at ?? null,
                }
              : null,
            googleBusiness: google
              ? {
                  checked: Boolean(google.checked),
                  found: google.found ?? null,
                  rating: google.rating ?? null,
                  reviewCount: google.review_count ?? null,
                  placeName: google.place_name ?? null,
                  checkedAt: google.checked_at ?? null,
                }
              : null,
            metaAds: meta
              ? {
                  checked: Boolean(meta.checked),
                  found: meta.found ?? null,
                  activeCount: meta.active_count ?? null,
                  checkedAt: meta.checked_at ?? null,
                }
              : null,
          },
          classification: classification
            ? {
                category: classification.category ?? null,
                confidence: classification.confidence ?? null,
                signalsChecked: classification.signals_checked ?? 0,
                signalsFound: classification.signals_found ?? 0,
                reasoning: trimTo(classification.reasoning, 1000),
                classifiedAt: classification.classified_at ?? null,
              }
            : null,
        },
      },
    });
  }

  console.log(`\nprepared ${prepared.length} lead(s), skipped ${skipped.length}`);
  console.log("tier distribution: ", JSON.stringify(tierCounts));
  console.log("prospecting status:", JSON.stringify(statusCounts));
  console.log("industry resolved: ", JSON.stringify(industryCounts));
  console.log("industry confidence:", JSON.stringify(confidenceCounts));
  console.log("segment split:     ", JSON.stringify(segmentCounts));
  console.log(`google business found: ${googleFound}`);
  console.log(`website found:         ${websiteFound}`);
  console.log(`reports to migrate:    ${reports.length}`);

  for (const entry of skipped.slice(0, 20)) {
    console.warn(`  skipped lead_id ${entry.leadId}: ${entry.reason}`);
  }

  if (!APPLY) {
    console.log("\nDry run complete - nothing written. Re-run with --apply to migrate.");
    await samvidClient.close();
    return;
  }

  await mongoose.connect(vegaUri, { dbName: vegaDb, family: 4 });

  let upserted = 0;
  let modified = 0;

  for (const { legacyLeadId, doc } of prepared) {
    const result = await LeadModel.updateOne(
      { "prospecting.legacyLeadId": legacyLeadId },
      { $set: doc },
      { upsert: true, runValidators: true },
    );
    if (result.upsertedCount) upserted += 1;
    else if (result.modifiedCount) modified += 1;
  }

  console.log(`\nleads upserted=${upserted} modified=${modified}`);

  let reportsWritten = 0;
  for (const report of reports) {
    const lead = await LeadModel.findOne({ "prospecting.legacyLeadId": report.lead_id })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId } | null>();

    if (!lead) {
      console.warn(`  report for lead_id ${report.lead_id} has no migrated lead - skipped`);
      continue;
    }
    if (!report.pdf) {
      console.warn(`  report for lead_id ${report.lead_id} has no pdf - skipped`);
      continue;
    }

    await ReportModel.updateOne(
      { legacyLeadId: report.lead_id },
      {
        $set: {
          leadId: lead._id,
          legacyLeadId: report.lead_id,
          pdf: Buffer.from(report.pdf.buffer),
          categoryUsed: report.category_used,
          paragraphSource: report.paragraph_source,
          generatedAt: report.generated_at ?? new Date(),
        },
      },
      { upsert: true },
    );
    reportsWritten += 1;
  }

  console.log(`reports written=${reportsWritten}`);

  await mongoose.disconnect();
  await samvidClient.close();
  console.log("\nMigration complete.");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

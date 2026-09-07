/**
 * Imports a sector-per-sheet lead workbook into Vega's unified Lead model.
 *
 * These workbooks carry one sheet per industry ("Textile & Apparel",
 * "Healthcare Services", ...), so the sector is known for every row before
 * it is ever read. That is the strongest industry signal there is, and it
 * gets recorded as `industryConfidence: "explicit"` - no guessing.
 *
 * Dry-run by default; pass --apply to write.
 *
 *   npm run import:sectors -- <file.xlsx>
 *   npm run import:sectors -- <file.xlsx> --apply
 *
 * Idempotent: upserts on (title + state), so re-running updates rather than
 * duplicating. Rows without a usable contact still import - they simply
 * can't be sent to until a contact-sourcing step exists.
 */
import path from "node:path";
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import { LeadModel } from "@/models/Lead";
import { scoreLead } from "@/lib/leads/scoring";
import {
  isKnownUnmappedIndustry,
  normalizeIndustryKey,
  resolveProspectIndustry,
} from "@/lib/prospecting/resolve-industry";

const APPLY = process.argv.includes("--apply");
const FILE = process.argv.find((a) => a.toLowerCase().endsWith(".xlsx"));

/**
 * These workbooks are curated B2B databases of established companies - they
 * carry LinkedIn pages, corporate websites and multi-plant manufacturers.
 * Without this, rows whose category text is inconclusive fall back to the
 * knowledge bank's bottom-up default and get labelled as small traders:
 * radio broadcasters became "Freelancer / Boutique Studio", e-commerce
 * logistics firms became "Small Local Transporter".
 *
 * Pass --segment-bias=small for a scraped list of small businesses.
 */
const SEGMENT_BIAS: "established" | "small" =
  process.argv.find((a) => a.startsWith("--segment-bias="))?.split("=")[1] === "small"
    ? "small"
    : "established";

/** Sheets that hold summary/config data rather than leads. */
const NON_LEAD_SHEETS = new Set(["lists", "dashboard"]);

const NOT_AVAILABLE = /^(not publicly available|not available|n\/?a|-|—)$/i;

function clean(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  if (!text || NOT_AVAILABLE.test(text)) return undefined;
  return text;
}

function firstEmail(value?: string) {
  if (!value) return undefined;
  const match = value.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return match ? match[0].toLowerCase() : undefined;
}

/** Header row isn't row 0 - these sheets open with a title and a target line. */
function findHeaderRow(rows: unknown[][]) {
  for (let i = 0; i < Math.min(rows.length, 10); i += 1) {
    const cells = rows[i].map((c) => String(c ?? "").toLowerCase());
    if (cells.some((c) => c.includes("company name")) && cells.some((c) => c.includes("industry"))) {
      return i;
    }
  }
  return -1;
}

function columnIndex(header: string[], ...names: string[]) {
  for (const name of names) {
    const i = header.findIndex((h) => h.toLowerCase().trim() === name.toLowerCase());
    if (i !== -1) return i;
  }
  for (const name of names) {
    const i = header.findIndex((h) => h.toLowerCase().includes(name.toLowerCase()));
    if (i !== -1) return i;
  }
  return -1;
}

async function main() {
  if (!FILE) {
    console.error("Usage: npm run import:sectors -- <file.xlsx> [--apply]");
    process.exit(1);
  }

  console.log(APPLY ? "MODE: APPLY (will write)" : "MODE: DRY RUN (no writes)");
  console.log(`file: ${path.basename(FILE)}\n`);

  const workbook = XLSX.readFile(FILE);

  const prepared: Array<Record<string, unknown>> = [];
  const industryCounts: Record<string, number> = {};
  const confidenceCounts: Record<string, number> = {};
  const segmentCounts: Record<string, number> = {};
  const unmapped: Record<string, number> = {};
  let skippedSheets = 0;
  let skippedRows = 0;
  let withEmail = 0;
  let withPhone = 0;

  for (const sheetName of workbook.SheetNames) {
    if (NON_LEAD_SHEETS.has(sheetName.toLowerCase().trim())) {
      skippedSheets += 1;
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      blankrows: false,
    });
    const headerRow = findHeaderRow(rows);
    if (headerRow === -1) {
      skippedSheets += 1;
      continue;
    }

    const header = rows[headerRow].map((c) => String(c ?? ""));
    const col = {
      name: columnIndex(header, "Company Name"),
      industry: columnIndex(header, "Industry"),
      category: columnIndex(header, "Business Category"),
      products: columnIndex(header, "Products / Services", "Products/Services", "Products"),
      address: columnIndex(header, "Full Address", "Address"),
      phone: columnIndex(header, "Phone Number", "Phone"),
      email: columnIndex(header, "Email"),
      website: columnIndex(header, "Website"),
      contact: columnIndex(header, "Contact Person"),
      source: columnIndex(header, "Source URL"),
    };

    // The sheet name is the sector. Fall back to the row's Industry column
    // if a sheet is named something unexpected.
    const sheetIndustry = normalizeIndustryKey(sheetName);
    const sheetUnmapped = !sheetIndustry && isKnownUnmappedIndustry(sheetName);

    for (const row of rows.slice(headerRow + 1)) {
      const name = clean(row[col.name]);
      if (!name || name.length < 3) {
        skippedRows += 1;
        continue;
      }

      const businessCategory = clean(row[col.category]);
      const productsServices = clean(row[col.products]);
      const rowIndustry = clean(row[col.industry]);
      const email = firstEmail(clean(row[col.email]));
      const phone = clean(row[col.phone])?.slice(0, 30);
      const address = clean(row[col.address]);
      const website = clean(row[col.website]);

      if (email) withEmail += 1;
      if (phone) withPhone += 1;

      const resolved = resolveProspectIndustry({
        // Sheet name first: it is the sector the row was collected under.
        industryLabel: sheetName,
        businessCategory,
        productsServices,
        name,
        segmentBias: SEGMENT_BIAS,
      });

      // Only consult the row's Industry column when the sheet name was
      // genuinely unrecognised. If the sheet names a sector we *know* has no
      // knowledge-bank entry, that is a definitive answer - re-resolving from
      // the row lets keyword matching guess, and it guesses wrong: three
      // "Entertainment, Events, Fitness" rows landed in media_communication
      // on the strength of "event management" appearing in their category.
      const finalResolved =
        resolved.industry || sheetUnmapped || !rowIndustry
          ? resolved
          : resolveProspectIndustry({
              industryLabel: rowIndustry,
              businessCategory,
              productsServices,
              name,
            });

      const key = finalResolved.industry ?? `(unresolved: ${sheetName})`;
      industryCounts[key] = (industryCounts[key] ?? 0) + 1;
      if (finalResolved.industry) {
        const sk = `${finalResolved.industry}/${finalResolved.segment ?? "(flat)"}`;
        segmentCounts[sk] = (segmentCounts[sk] ?? 0) + 1;
      }
      confidenceCounts[finalResolved.confidence] =
        (confidenceCounts[finalResolved.confidence] ?? 0) + 1;
      if (finalResolved.unmappedLabel || sheetUnmapped) {
        const label = finalResolved.unmappedLabel ?? sheetName;
        unmapped[label] = (unmapped[label] ?? 0) + 1;
      }

      prepared.push({
        title: name.slice(0, 200),
        email,
        phone,
        source: "cold_outreach",
        status: "new",
        tags: [],
        ...scoreLead({ source: "cold_outreach" }),
        prospecting: {
          industry: finalResolved.industry ?? undefined,
          segment: finalResolved.segment ?? undefined,
          industryConfidence: finalResolved.confidence,
          industryMatchedOn: finalResolved.matchedOn,
          unmappedIndustryLabel: finalResolved.unmappedLabel ?? (sheetUnmapped ? sheetName : null),
          businessCategory: businessCategory || productsServices,
          district: address?.split(",").slice(-2)[0]?.trim().slice(0, 100),
          prospectingStatus: "new",
          digitalPresence: website
            ? { website: { found: true, url: website.slice(0, 500), checkedAt: new Date() } }
            : undefined,
        },
      });
    }
  }

  console.log(`prepared ${prepared.length} lead(s)`);
  console.log(`skipped: ${skippedSheets} non-lead sheet(s), ${skippedRows} unusable row(s)`);
  console.log(`with email: ${withEmail}  with phone: ${withPhone}`);
  console.log("\nindustry distribution:");
  for (const [industry, n] of Object.entries(industryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${industry}`);
  }
  console.log("confidence:", JSON.stringify(confidenceCounts));
  console.log("\nsegment split (industry/segment):");
  for (const [k, n] of Object.entries(segmentCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${k}`);
  }
  if (Object.keys(unmapped).length) {
    console.log("\nsectors with no knowledge-bank entry (import fine, generic report copy):");
    for (const [label, n] of Object.entries(unmapped)) console.log(`  ${String(n).padStart(4)}  ${label}`);
  }

  if (!APPLY) {
    console.log("\nDry run complete - nothing written. Re-run with --apply to import.");
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI!, {
    dbName: process.env.MONGODB_DB_NAME!,
    family: 4,
  });

  let upserted = 0;
  let modified = 0;
  for (const doc of prepared) {
    const result = await LeadModel.updateOne(
      { title: doc.title, source: "cold_outreach" },
      { $set: doc },
      { upsert: true, runValidators: true },
    );
    if (result.upsertedCount) upserted += 1;
    else if (result.modifiedCount) modified += 1;
  }

  console.log(`\nleads upserted=${upserted} modified=${modified}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});

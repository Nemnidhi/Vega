import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { LeadModel } from "@/models";
import {
  createLeadSchema,
  leadCategoryValues,
  leadSourceValues,
  leadUrgencyValues,
} from "@/lib/validation/lead";
import { scoreLead } from "@/lib/leads/scoring";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { handleApiError, fail, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";

const bulkUploadSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
});

const sourceSet = new Set<string>(leadSourceValues);
const categorySet = new Set<string>(leadCategoryValues);
const urgencySet = new Set<string>(leadUrgencyValues);

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeEnumToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function toOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function toRowMap(row: Record<string, unknown>) {
  const next = new Map<string, string>();

  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeKey(key);
    const text = toOptionalString(value);
    if (!normalized || !text) continue;
    next.set(normalized, text);
  }

  return next;
}

function readField(row: Map<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row.get(alias);
    if (value) return value;
  }
  return undefined;
}

function firstTokenFromList(value?: string) {
  if (!value) return undefined;
  return value
    .split(/[|;,]+/)
    .map((item) => item.trim())
    .find((item) => item.length > 0);
}

function extractFirstValidEmail(value?: string) {
  if (!value) return undefined;

  const tokens = value
    .split(/[|;,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i;

  for (const token of tokens) {
    const cleaned = token.replace(/[<>"'()]/g, "").trim().toLowerCase();
    const compact = cleaned.replace(/\s+/g, "");
    if (emailRegex.test(compact)) {
      return compact;
    }
  }

  return undefined;
}

function formatRowError(error: unknown) {
  if (error instanceof z.ZodError) {
    const firstIssue = error.issues[0];
    if (!firstIssue) return "Validation failed.";
    const fieldPath = firstIssue.path.join(".");
    return fieldPath ? `${fieldPath}: ${firstIssue.message}` : firstIssue.message;
  }
  return error instanceof Error ? error.message : "Invalid row.";
}

function parseBudget(row: Map<string, string>) {
  const minRaw = readField(row, [
    "budgetmin",
    "minbudget",
    "budgetfrom",
    "budgetminimum",
    "minamount",
  ]);
  const maxRaw = readField(row, [
    "budgetmax",
    "maxbudget",
    "budgetto",
    "budgetmaximum",
    "maxamount",
  ]);

  if (!minRaw && !maxRaw) return undefined;

  const minValue = minRaw ? Number(minRaw.replace(/,/g, "")) : NaN;
  const maxValue = maxRaw ? Number(maxRaw.replace(/,/g, "")) : NaN;

  const finalMin = Number.isFinite(minValue)
    ? minValue
    : Number.isFinite(maxValue)
      ? maxValue
      : NaN;
  const finalMax = Number.isFinite(maxValue)
    ? maxValue
    : Number.isFinite(minValue)
      ? minValue
      : NaN;

  if (!Number.isFinite(finalMin) || !Number.isFinite(finalMax)) {
    throw new Error("Budget values must be numeric.");
  }
  if (finalMax < finalMin) {
    throw new Error("Budget max must be greater than or equal to budget min.");
  }

  const currency = readField(row, ["budgetcurrency", "currency"]) || "INR";

  return {
    min: finalMin,
    max: finalMax,
    currency: currency.toUpperCase() === "USD" ? "USD" : "INR",
  } as const;
}

function parseTags(row: Map<string, string>) {
  const raw = readField(row, ["tags", "tag"]);
  const section = readField(row, ["relatedcontactsections"]);
  const status = readField(row, ["applicationstatus"]);
  const profileUrl = readField(row, ["profileurl"]);

  const tags = (raw ? raw.split(/[,;]+/) : [])
    .map((item) => item.trim())
    .filter(Boolean);

  if (section) {
    tags.push(...section.split(/[|,;]+/).map((item) => item.trim()).filter(Boolean));
  }
  if (status) {
    tags.push(status.trim());
  }
  if (profileUrl?.toLowerCase().includes("rera")) {
    tags.push("rera");
  }

  return [...new Set(tags.map((tag) => tag.slice(0, 40)))].slice(0, 20);
}

function parseSource(row: Map<string, string>) {
  const raw = readField(row, ["source", "leadsource"]);
  if (!raw) return "website";
  const normalized = normalizeEnumToken(raw);
  return sourceSet.has(normalized) ? normalized : "website";
}

function parseCategory(row: Map<string, string>) {
  const raw = readField(row, ["category", "type", "leadcategory"]);
  if (!raw) return "software_request";
  const normalized = normalizeEnumToken(raw);
  return categorySet.has(normalized) ? normalized : "software_request";
}

function parseUrgency(row: Map<string, string>) {
  const raw = readField(row, ["urgency", "priority"]);
  if (!raw) return "medium";
  const normalized = normalizeEnumToken(raw);
  return urgencySet.has(normalized) ? normalized : "medium";
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const payload = bulkUploadSchema.parse(await request.json());
    const preparedRows: Array<Record<string, unknown>> = [];
    const failedRows: Array<{ row: number; reason: string }> = [];

    payload.rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;

      try {
        const row = toRowMap(rawRow);
        const contactName =
          readField(row, [
            "contactname",
            "contactperson",
            "contact",
            "name",
            "agentname",
            "proprietorname",
          ]) ||
          firstTokenFromList(
            readField(row, ["relatedcontactnames"]),
          );
        const emailCandidate = readField(row, [
          "email",
          "emailid",
          "contactemail",
          "mainemail",
          "allemails",
          "relatedcontactemails",
        ]);
        const email = extractFirstValidEmail(emailCandidate);

        if (!contactName) {
          throw new Error("Contact name is required.");
        }
        if (!email) {
          throw new Error("Email is required.");
        }

        const titleFromCsv = readField(row, ["title", "leadtitle", "agentname"]);
        const title = titleFromCsv || `${contactName} enquiry`;
        const descriptionFromCsv = readField(row, [
          "description",
          "message",
          "requirement",
          "notes",
          "summary",
          "relatedcontactssummary",
        ]);
        const phone = firstTokenFromList(
          readField(row, [
            "phone",
            "mobile",
            "mobilenumber",
            "contactnumber",
            "relatedcontactphones",
          ]),
        );
        const mainAddress = readField(row, ["mainaddress", "relatedcontactaddresses"]);
        const applicationStatus = readField(row, ["applicationstatus"]);
        const profileUrl = readField(row, ["profileurl"]);

        const builtDescription = [
          descriptionFromCsv,
          mainAddress ? `Address: ${mainAddress}` : null,
          applicationStatus ? `Application Status: ${applicationStatus}` : null,
          profileUrl ? `Profile URL: ${profileUrl}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        const description = builtDescription || `Lead imported from CSV for ${title}.`;

        const leadData = createLeadSchema.parse({
          title,
          contactName,
          email,
          phone: phone || undefined,
          source: parseSource(row),
          category: parseCategory(row),
          urgency: parseUrgency(row),
          description,
          budget: parseBudget(row),
          tags: parseTags(row),
        });

        const scoring = scoreLead({
          source: leadData.source,
          category: leadData.category,
          urgency: leadData.urgency,
          budget: leadData.budget,
        });

        preparedRows.push({
          ...leadData,
          ...scoring,
          ownerId: actor.userId,
        });
      } catch (rowError) {
        failedRows.push({
          row: rowNumber,
          reason: formatRowError(rowError),
        });
      }
    });

    if (!preparedRows.length) {
      return fail("No valid lead rows found in CSV.", 422, {
        failedCount: failedRows.length,
        failedRows,
      });
    }

    const created = await LeadModel.insertMany(preparedRows);

    return ok(
      {
        createdCount: created.length,
        failedCount: failedRows.length,
        failedRows: failedRows.slice(0, 100),
        createdLeadIds: created.map((item) => String(item._id)),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  return ok(
    serializeForJson({
      requiredColumns: ["contactName", "email"],
      recommendedColumns: [
        "title",
        "phone",
        "source",
        "category",
        "urgency",
        "description",
        "budgetMin",
        "budgetMax",
        "budgetCurrency",
        "tags",
      ],
      acceptedSourceValues: leadSourceValues,
      acceptedCategoryValues: leadCategoryValues,
      acceptedUrgencyValues: leadUrgencyValues,
    }),
  );
}

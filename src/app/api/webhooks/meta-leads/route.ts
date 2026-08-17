// Meta Lead Ads webhook, adapted from Office on Rent's webhook.controller.js pattern (a
// different client's codebase, referenced only) - simplified since Vega is single-tenant, no
// page-to-company routing needed. Unlike the reference, verifies X-Hub-Signature-256 on every
// POST (Meta's own documented best practice) before processing anything.

import crypto from "node:crypto";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getServerEnv } from "@/lib/env/server";
import { LeadModel } from "@/models";
import { scoreLead } from "@/lib/leads/scoring";
import { handleApiError, ok, fail } from "@/lib/api/responses";

const META_GRAPH_VERSION = "v24.0";

export async function GET(request: Request) {
  const { META_VERIFY_TOKEN } = getServerEnv();
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && META_VERIFY_TOKEN && token === META_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader) return false;
  const [algo, providedHex] = signatureHeader.split("=");
  if (algo !== "sha256" || !providedHex) return false;

  const expectedHex = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const expected = Buffer.from(expectedHex, "hex");
  const provided = Buffer.from(providedHex, "hex");
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}

type LeadgenEvent = { leadId: string; pageId: string; formId: string };

function extractLeadEvents(body: unknown): LeadgenEvent[] {
  const events: LeadgenEvent[] = [];
  if (!body || typeof body !== "object") return events;
  const obj = body as { object?: string; entry?: unknown[] };
  if (obj.object !== "page") return events;

  for (const entry of obj.entry ?? []) {
    const pageId = String((entry as { id?: string })?.id ?? "").trim();
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const c = change as { field?: string; value?: { leadgen_id?: string; form_id?: string } };
      if (String(c?.field ?? "").trim().toLowerCase() !== "leadgen") continue;
      const leadId = String(c?.value?.leadgen_id ?? "").trim();
      if (!leadId) continue;
      events.push({ leadId, pageId, formId: String(c?.value?.form_id ?? "").trim() });
    }
  }
  return events;
}

function normalizeFieldData(rows: Array<{ name?: string; values?: string[] }>) {
  const map = new Map<string, string>();
  for (const field of rows ?? []) {
    const key = String(field?.name ?? "").trim().toLowerCase();
    if (!key) continue;
    const value = String(field?.values?.[0] ?? "").trim();
    if (!value) continue;
    map.set(key, value);
  }

  const readFirst = (...keys: string[]) => {
    for (const key of keys) {
      const value = map.get(key);
      if (value) return value;
    }
    return "";
  };

  const firstName = readFirst("first_name", "firstname");
  const lastName = readFirst("last_name", "lastname");
  const fullName = readFirst("full_name", "name") || [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    name: fullName,
    phone: readFirst("phone_number", "phone", "mobile_number", "mobile"),
    email: readFirst("email", "email_address"),
  };
}

// Vega requires an email on every non-cold_outreach Lead, but a Lead Ad form isn't guaranteed to
// ask for one (some forms are phone-only) - fall back to a traceable placeholder rather than
// dropping a real lead over a missing field.
function buildFallbackEmail(leadId: string) {
  return `meta-lead-${leadId}@leads.nemnidhi.com`;
}

export async function POST(request: Request) {
  try {
    const { META_APP_SECRET } = getServerEnv();
    if (!META_APP_SECRET) {
      throw new Error("Not configured: META_APP_SECRET is unset");
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    if (!verifySignature(rawBody, signature, META_APP_SECRET)) {
      throw new Error("Unauthorized: invalid webhook signature");
    }

    await connectToDatabase();

    const payload = JSON.parse(rawBody);
    const events = extractLeadEvents(payload);
    if (!events.length) {
      return ok({ received: 0, created: 0, duplicate: 0 });
    }

    const { META_PAGE_ACCESS_TOKEN } = getServerEnv();
    let created = 0;
    let duplicate = 0;

    for (const event of events) {
      const existing = await LeadModel.findOne({ metaLeadId: event.leadId }).select("_id").lean();
      if (existing) {
        duplicate += 1;
        continue;
      }

      if (!META_PAGE_ACCESS_TOKEN) {
        console.error("meta-leads webhook: META_PAGE_ACCESS_TOKEN unset, cannot pull field_data for", event.leadId);
        continue;
      }

      const graphUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${event.leadId}?fields=field_data&access_token=${encodeURIComponent(META_PAGE_ACCESS_TOKEN)}`;
      const graphRes = await fetch(graphUrl);
      if (!graphRes.ok) {
        console.error("meta-leads webhook: Graph API pull failed for", event.leadId, await graphRes.text());
        continue;
      }
      const graphData = (await graphRes.json()) as { field_data?: Array<{ name?: string; values?: string[] }> };
      const normalized = normalizeFieldData(graphData.field_data ?? []);

      try {
        await LeadModel.create({
          title: `${normalized.name || "Meta Lead"} - Meta Ads inquiry`,
          contactName: normalized.name || "Unknown",
          email: normalized.email || buildFallbackEmail(event.leadId),
          phone: normalized.phone || undefined,
          source: "paid_ads",
          category: "other",
          urgency: "medium",
          description: "Submitted via a Meta Lead Ad form - no additional detail provided at capture time.",
          tags: ["meta_ads_launch"],
          metaLeadId: event.leadId,
          metaPageId: event.pageId,
          metaFormId: event.formId,
          ...scoreLead({ source: "paid_ads", category: "other", urgency: "medium" }),
        });
        created += 1;
      } catch (createError) {
        // Race: two webhook deliveries for the same leadgen_id landed concurrently - the unique
        // index on metaLeadId is the real guard, the findOne check above is just the fast path.
        if (createError instanceof Error && createError.message.includes("metaLeadId")) {
          duplicate += 1;
          continue;
        }
        throw createError;
      }
    }

    return ok({ received: events.length, created, duplicate });
  } catch (error) {
    console.error("meta-leads webhook failed:", error);
    if (error instanceof Error && error.message.startsWith("Not configured")) {
      return fail(error.message, 503);
    }
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return fail(error.message, 401);
    }
    return handleApiError(error);
  }
}

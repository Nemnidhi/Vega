// A WhatsApp conversation becoming a real Vega Lead - the piece that was missing entirely: every
// other Dashboard->Vega event (dashboard-events/route.ts) only ever updates an EXISTING Client, so
// none of them could handle "this is someone we've never talked to before." Called from
// Dashboard-WhatsApp's ensureConversationInCrm the first time a contact becomes a lead there
// (crm.addedToCrmAt was previously unset), not on every message in an ongoing conversation.
//
// Idempotent on Lead.dashboardConversationId (unique/sparse) rather than a read-then-write race:
// a duplicate push (Dashboard's own webhook redelivering, or two near-simultaneous inbound
// messages both triggering "first time") upserts to the same Lead instead of creating a second
// one, same discipline BillStack's own IntegrationEvent dedupe and Meta's leadgen_id dedupe here
// already follow.
import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidDashboardSecret } from "@/lib/auth/dashboard-actor";
import { dashboardLeadSchema } from "@/lib/validation/integrations";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { LeadModel } from "@/models";
import { scoreLead } from "@/lib/leads/scoring";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

export async function POST(request: Request) {
  let payload;
  try {
    assertValidDashboardSecret(request);
    await connectToDatabase();
    payload = dashboardLeadSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Not configured")) {
      return fail(error.message, 503);
    }
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return fail(error.message, 401);
    }
    return handleApiError(error);
  }

  try {
    const existing = await LeadModel.findOne({ dashboardConversationId: payload.conversationId }).select("_id");
    if (existing) {
      return ok(serializeForJson({ leadId: existing._id.toString(), created: false }));
    }

    const contactName = payload.contactName?.trim() || payload.phone;
    // A real ctwa_clid means Meta itself attributes this conversation to a specific ad click -
    // the honest signal for "paid_ads", not a guess. Anything else (an organic inbound WhatsApp
    // message) genuinely isn't any of the other source values, so it stays "other" rather than
    // being misclassified as an ad lead it never was.
    const source = payload.ctwaClid ? ("paid_ads" as const) : ("other" as const);
    const campaignLine = payload.campaign ? ` Campaign: ${payload.campaign}.` : "";
    const messageLine = payload.firstMessage ? ` First message: "${payload.firstMessage.slice(0, 300)}"` : "";
    const description =
      `Captured from a live WhatsApp conversation via Dashboard-WhatsApp.${campaignLine}${messageLine}`.trim();

    const lead = await LeadModel.create({
      title: `${contactName} - WhatsApp enquiry`,
      contactName,
      // WhatsApp never supplies an email, and it's a required field for an inbound lead - a real,
      // non-deliverable reserved-TLD placeholder (.local can never resolve or collide with a real
      // address), same convention Dashboard-WhatsApp's own WhatsApp-OTP signup already uses.
      email: `wa_${payload.phone.replace(/[^\d]/g, "")}@leads.dashboard-whatsapp.local`,
      phone: payload.phone,
      source,
      category: "software_request",
      urgency: "medium",
      description: description.length >= 10 ? description : "Captured from a live WhatsApp conversation via Dashboard-WhatsApp.",
      tags: ["dashboard_whatsapp", ...(payload.ctwaClid ? ["ctwa"] : [])],
      dashboardConversationId: payload.conversationId,
      ...scoreLead({ source, category: "software_request", urgency: "medium" }),
    });

    await logActivity({
      action: "dashboard_lead_captured",
      entityType: "lead",
      entityId: lead._id.toString(),
      details: {
        dashboardOrganizationId: payload.dashboardOrganizationId,
        conversationId: payload.conversationId,
        source,
        campaign: payload.campaign || null,
      },
    });

    return ok(serializeForJson({ leadId: lead._id.toString(), created: true }), { status: 201 });
  } catch (error) {
    // A racing duplicate push hits the unique index instead of the read-then-create check above -
    // treat it the same way, not as a real failure.
    if ((error as { code?: number })?.code === 11000) {
      const existing = await LeadModel.findOne({ dashboardConversationId: payload.conversationId }).select("_id");
      if (existing) {
        return ok(serializeForJson({ leadId: existing._id.toString(), created: false }));
      }
    }
    return handleApiError(error);
  }
}

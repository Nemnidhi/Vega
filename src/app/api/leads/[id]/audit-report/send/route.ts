// Emails a previously-generated audit report to the lead.
//
// This is the one route in the audit pipeline that touches the outside
// world, so it is deliberately conservative: it will not generate a report
// on the fly, it enforces a daily cap across all leads, and it refuses to
// send twice for the same report unless explicitly told to.

import { connectToDatabase } from "@/lib/db/mongodb";
import { LeadModel, ReportModel } from "@/models";
import { handleApiError, fail, ok } from "@/lib/api/responses";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity/logging";
import { sendAuditReportEmail } from "@/lib/prospecting/send-audit-report";
import { toProspectSubject } from "@/lib/prospecting/lead-adapter";
import type { Lead } from "@/types/lead";

type Params = Promise<{ id: string }>;

const DAILY_SEND_LIMIT = Number(process.env.AUDIT_SEND_DAILY_LIMIT ?? "10");

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const { id } = await params;
    const url = new URL(request.url);
    const resend = url.searchParams.get("resend") === "true";

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const sentToday = await ReportModel.countDocuments({ sentAt: { $gte: startOfToday } });

    if (sentToday >= DAILY_SEND_LIMIT) {
      return fail(
        `Daily send limit reached (${sentToday}/${DAILY_SEND_LIMIT}). Try again tomorrow.`,
        429,
      );
    }

    const lead = await LeadModel.findById(id).lean<Lead | null>();
    if (!lead) {
      return fail("Lead not found", 404);
    }
    if (!lead.email) {
      return fail("Lead has no email address on file", 422);
    }

    const report = await ReportModel.findOne({ leadId: id }).sort({ generatedAt: -1 });
    if (!report) {
      return fail("No audit report generated for this lead yet - generate one first", 409);
    }
    if (report.sentAt && !resend) {
      return fail(
        `This report was already sent on ${new Date(report.sentAt).toISOString()}. Pass ?resend=true to send it again.`,
        409,
      );
    }

    const pdf: Buffer = Buffer.isBuffer(report.pdf) ? report.pdf : Buffer.from(report.pdf.buffer);

    const result = await sendAuditReportEmail({
      lead: toProspectSubject(lead),
      to: lead.email,
      pdfBuffer: pdf,
    });

    if (!result.sent) {
      return fail("SMTP is not configured - cannot send", 503);
    }

    const sentAt = new Date();
    report.sentAt = sentAt;
    report.sentTo = lead.email;
    await report.save();

    await LeadModel.updateOne(
      { _id: lead._id },
      { $set: { "prospecting.prospectingStatus": "sent" } },
    );

    await logActivity({
      action: "audit_report_sent",
      actorId: actor.userId,
      entityType: "lead",
      entityId: String(lead._id),
      details: { to: lead.email, messageId: result.messageId, resend },
    });

    return ok({
      messageId: result.messageId,
      to: lead.email,
      sentToday: sentToday + 1,
      dailyLimit: DAILY_SEND_LIMIT,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// Outreach email carrying the digital-presence audit report as a PDF
// attachment. Ported from Samvid's src/lib/sendEmail.js, but using Vega's
// shared SMTP config rather than its own transport.

import { createMailTransport, readMailConfig } from "@/lib/notifications/mailer";
import { getIndustryLabel } from "@/lib/prospecting/industry-knowledge";
import type { ProspectSubject } from "@/lib/prospecting/types";

/**
 * Outreach copy. This used to hardcode "real estate businesses", which was
 * true of every lead when the engine was real-estate only and plainly wrong
 * for the other 19 industries.
 *
 * Both the sector and the location degrade to a neutral phrasing when we
 * don't know them - an email that says "local businesses" is honest, one
 * that tells a textile mill we were reviewing real estate is not. The
 * segment is deliberately not used here: "Wholesale / Retail / Trade-Facing
 * businesses" reads like internal jargon in a cold email.
 */
export function buildEmailContent(lead: ProspectSubject) {
  const location = [lead.district, lead.state].filter(Boolean).join(", ");
  const industry = getIndustryLabel(lead.industry);

  const audience = industry ? `${industry} businesses` : "local businesses";
  const where = location ? ` in ${location}` : "";

  const subject = `${lead.name} - a quick look at your online presence`;
  const text =
    `Hi,\n\n` +
    `We took a quick look at ${lead.name}'s online presence as part of a review of ` +
    `${audience}${where}. Attached is a short report summarizing ` +
    `what we found and what it could mean for reaching more clients online.\n\n` +
    `Best,\nSamvid Team`;
  return { subject, text };
}

export type SendAuditReportResult =
  | { sent: false; reason: "missing_smtp_config" }
  | { sent: true; messageId: string };

export async function sendAuditReportEmail({
  lead,
  to,
  pdfBuffer,
}: {
  lead: ProspectSubject;
  to: string;
  pdfBuffer: Buffer;
}): Promise<SendAuditReportResult> {
  const config = readMailConfig();
  if (!config) {
    return { sent: false, reason: "missing_smtp_config" };
  }

  const { subject, text } = buildEmailContent(lead);
  const safeName = lead.name.replace(/[^a-z0-9]+/gi, "_").slice(0, 60);

  const info = await createMailTransport(config).sendMail({
    from: `"${config.fromName}" <${config.from}>`,
    to,
    subject,
    text,
    attachments: [
      {
        filename: `${safeName}-report.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return { sent: true, messageId: info.messageId };
}

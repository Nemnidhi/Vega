import { createMailTransport, readMailConfig } from "@/lib/notifications/mailer";
import { MEETING_TIME_ZONE } from "@/lib/meetings/date";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMeetingTime(startAt: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: MEETING_TIME_ZONE,
    dateStyle: "full",
    timeStyle: "short",
  }).format(startAt);
}

export type SendMeetingConfirmationResult =
  | { sent: false; reason: "missing_smtp_config" }
  | { sent: true; messageId: string };

export async function sendMeetingConfirmationEmail({
  to,
  contactName,
  type,
  startAt,
  durationMinutes,
  location,
}: {
  to: string;
  contactName: string;
  type: "online" | "in_person";
  startAt: Date;
  durationMinutes: number;
  location: string;
}): Promise<SendMeetingConfirmationResult> {
  const config = readMailConfig();
  if (!config) {
    return { sent: false, reason: "missing_smtp_config" };
  }

  const whenText = formatMeetingTime(startAt);
  const typeLabel = type === "online" ? "Online call" : "In-person meeting";
  const onlineNote =
    type === "online" ? "The meeting link will be shared with you before the call." : "";

  const subject = `Meeting confirmed - ${whenText}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <p>Hi ${escapeHtml(contactName)},</p>
      <p>Your meeting with ${escapeHtml(config.fromName)} is confirmed.</p>
      <table style="margin: 16px 0; font-size: 14px;">
        <tr><td style="color:#4b5563; padding-right:12px;">When</td><td><strong>${escapeHtml(whenText)}</strong> (${durationMinutes} min)</td></tr>
        <tr><td style="color:#4b5563; padding-right:12px;">Type</td><td>${escapeHtml(typeLabel)}</td></tr>
        <tr><td style="color:#4b5563; padding-right:12px;">${type === "online" ? "Details" : "Location"}</td><td>${escapeHtml(location)}</td></tr>
      </table>
      ${onlineNote ? `<p style="color: #4b5563; font-size: 12px;">${escapeHtml(onlineNote)}</p>` : ""}
    </div>
  `;
  const text = [
    `Hi ${contactName},`,
    "",
    `Your meeting with ${config.fromName} is confirmed.`,
    `When: ${whenText} (${durationMinutes} min)`,
    `Type: ${typeLabel}`,
    `${type === "online" ? "Details" : "Location"}: ${location}`,
    onlineNote,
  ]
    .filter(Boolean)
    .join("\n");

  const info = await createMailTransport(config).sendMail({
    from: `"${config.fromName}" <${config.from}>`,
    to,
    subject,
    html,
    text,
  });

  return { sent: true, messageId: info.messageId };
}

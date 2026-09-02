import { createMailTransport, readMailConfig } from "@/lib/notifications/mailer";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export type SendClientInviteResult =
  | { sent: false; reason: "missing_smtp_config" }
  | { sent: true; messageId: string };

export async function sendClientInviteEmail({
  to,
  businessName,
  activationLink,
}: {
  to: string;
  businessName: string;
  activationLink: string;
}): Promise<SendClientInviteResult> {
  const config = readMailConfig();
  if (!config) {
    return { sent: false, reason: "missing_smtp_config" };
  }

  const subject = `You're invited: set up your ${config.fromName} client portal login`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <p>Hi,</p>
      <p>We've set up a client portal login for ${escapeHtml(businessName)} so you can review your digital-presence audit and the requirements we're putting together.</p>
      <p>
        <a href="${escapeHtml(activationLink)}" style="color: #1d4ed8; font-weight: 600;">
          Set up your login
        </a>
      </p>
      <p style="color: #4b5563; font-size: 12px;">If the link does not open, copy this URL: ${escapeHtml(activationLink)}</p>
      <p style="color: #4b5563; font-size: 12px;">This link expires in 7 days.</p>
    </div>
  `;
  const text = [
    "Hi,",
    "",
    `We've set up a client portal login for ${businessName} so you can review your digital-presence audit and the requirements we're putting together.`,
    `Set up your login: ${activationLink}`,
    "",
    "This link expires in 7 days.",
  ].join("\n");

  const info = await createMailTransport(config).sendMail({
    from: `"${config.fromName}" <${config.from}>`,
    to,
    subject,
    html,
    text,
  });

  return { sent: true, messageId: info.messageId };
}

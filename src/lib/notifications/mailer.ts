import nodemailer from "nodemailer";

// Shared SMTP configuration. Every outbound email in the app goes through
// this, so credentials and the from-address are defined in exactly one place.

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  from: string;
  fromName: string;
};

export function readMailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const rawPort = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim() || user;
  const fromName =
    process.env.SMTP_FROM_NAME?.trim() ||
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    "HRMS Command Center";

  if (!host || !fromEmail) {
    return null;
  }

  const parsedPort = rawPort ? Number(rawPort) : 587;
  if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
    return null;
  }

  return {
    host,
    port: parsedPort,
    // Port 465 is implicit TLS; 587 upgrades via STARTTLS.
    secure: parsedPort === 465,
    auth: user && pass ? { user, pass } : undefined,
    from: fromEmail,
    fromName,
  };
}

export function createMailTransport(config: MailConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
}

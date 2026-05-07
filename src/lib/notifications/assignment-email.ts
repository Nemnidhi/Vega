import nodemailer from "nodemailer";

type ProjectAssignmentEmailInput = {
  developerEmail: string;
  developerName?: string;
  assignedByName?: string;
  projectId: string;
  projectTitle: string;
  projectDescription?: string;
  requestOrigin?: string;
  requestHeaders?: Headers;
};

type TaskAssignmentEmailInput = {
  developerEmail: string;
  developerName?: string;
  assignedByName?: string;
  projectId: string;
  projectTitle: string;
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  requestOrigin?: string;
  requestHeaders?: Headers;
};

type MailConfig = {
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

function readMailConfig(): MailConfig | null {
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
    secure: parsedPort === 465,
    auth: user && pass ? { user, pass } : undefined,
    from: fromEmail,
    fromName,
  };
}

function normalizeBaseUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function isLocalhostUrl(value: string) {
  try {
    const parsed = new URL(value);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "0.0.0.0"
    );
  } catch {
    return false;
  }
}

function firstHeaderValue(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .split(",")[0]
    ?.trim()
    .replace(/^"+|"+$/g, "");
}

function getBaseUrl(input: { requestOrigin?: string; requestHeaders?: Headers }) {
  const appBaseUrl = normalizeBaseUrl(process.env.APP_BASE_URL);
  const publicAppUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  const requestOrigin = normalizeBaseUrl(input.requestOrigin);

  const forwardedHost = firstHeaderValue(
    input.requestHeaders?.get("x-forwarded-host") ?? input.requestHeaders?.get("host") ?? null,
  );
  const forwardedProto =
    firstHeaderValue(input.requestHeaders?.get("x-forwarded-proto") ?? null) ??
    (forwardedHost?.includes("localhost") ? "http" : "https");
  const forwardedOrigin = forwardedHost
    ? normalizeBaseUrl(`${forwardedProto}://${forwardedHost}`)
    : null;

  const candidates = [appBaseUrl, publicAppUrl, forwardedOrigin, requestOrigin].filter(
    (value): value is string => Boolean(value),
  );
  const nonLocalCandidate = candidates.find((value) => !isLocalhostUrl(value));

  if (process.env.NODE_ENV === "production" && nonLocalCandidate) {
    return nonLocalCandidate;
  }

  return candidates[0] ?? "http://localhost:3000";
}

function getProjectLink(baseUrl: string, projectId: string, taskId?: string) {
  const path = taskId ? `/projects/${projectId}#task-${taskId}` : `/projects/${projectId}`;
  return `${baseUrl}${path}`;
}

function escapeHtml(value?: string | null) {
  if (!value) {
    return "";
  }

  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function compactText(value?: string | null) {
  if (!value) {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
}

async function sendAssignmentEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const config = readMailConfig();
  if (!config) {
    return { sent: false as const, reason: "missing_smtp_config" as const };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  await transporter.sendMail({
    from: `"${config.fromName}" <${config.from}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  return { sent: true as const };
}

export async function sendProjectAssignmentEmail(input: ProjectAssignmentEmailInput) {
  const baseUrl = getBaseUrl({
    requestOrigin: input.requestOrigin,
    requestHeaders: input.requestHeaders,
  });
  const projectLink = getProjectLink(baseUrl, input.projectId);
  const developerName = compactText(input.developerName) || "Developer";
  const assignedByName = compactText(input.assignedByName) || "Admin";
  const projectTitle = compactText(input.projectTitle);
  const projectDescription = compactText(input.projectDescription);

  const subject = `New project assigned: ${projectTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <p>Hi ${escapeHtml(developerName)},</p>
      <p>${escapeHtml(assignedByName)} has assigned a new project to you.</p>
      <p><strong>Project:</strong> ${escapeHtml(projectTitle)}</p>
      ${
        projectDescription
          ? `<p><strong>Overview:</strong> ${escapeHtml(projectDescription)}</p>`
          : ""
      }
      <p>
        <a href="${escapeHtml(projectLink)}" style="color: #1d4ed8; font-weight: 600;">
          Open Project
        </a>
      </p>
      <p style="color: #4b5563; font-size: 12px;">If the link does not open, copy this URL: ${escapeHtml(projectLink)}</p>
    </div>
  `;

  const text = [
    `Hi ${developerName},`,
    "",
    `${assignedByName} has assigned a new project to you.`,
    `Project: ${projectTitle}`,
    projectDescription ? `Overview: ${projectDescription}` : "",
    `Open Project: ${projectLink}`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendAssignmentEmail({
    to: input.developerEmail,
    subject,
    html,
    text,
  });
}

export async function sendTaskAssignmentEmail(input: TaskAssignmentEmailInput) {
  const baseUrl = getBaseUrl({
    requestOrigin: input.requestOrigin,
    requestHeaders: input.requestHeaders,
  });
  const taskLink = getProjectLink(baseUrl, input.projectId, input.taskId);
  const developerName = compactText(input.developerName) || "Developer";
  const assignedByName = compactText(input.assignedByName) || "Admin";
  const projectTitle = compactText(input.projectTitle);
  const taskTitle = compactText(input.taskTitle);
  const taskDescription = compactText(input.taskDescription);

  const subject = `New task assigned: ${taskTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <p>Hi ${escapeHtml(developerName)},</p>
      <p>${escapeHtml(assignedByName)} has assigned a new task to you.</p>
      <p><strong>Project:</strong> ${escapeHtml(projectTitle)}</p>
      <p><strong>Task:</strong> ${escapeHtml(taskTitle)}</p>
      ${
        taskDescription
          ? `<p><strong>Task overview:</strong> ${escapeHtml(taskDescription)}</p>`
          : ""
      }
      <p>
        <a href="${escapeHtml(taskLink)}" style="color: #1d4ed8; font-weight: 600;">
          Go To Task
        </a>
      </p>
      <p style="color: #4b5563; font-size: 12px;">If the link does not open, copy this URL: ${escapeHtml(taskLink)}</p>
    </div>
  `;

  const text = [
    `Hi ${developerName},`,
    "",
    `${assignedByName} has assigned a new task to you.`,
    `Project: ${projectTitle}`,
    `Task: ${taskTitle}`,
    taskDescription ? `Task overview: ${taskDescription}` : "",
    `Go To Task: ${taskLink}`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendAssignmentEmail({
    to: input.developerEmail,
    subject,
    html,
    text,
  });
}

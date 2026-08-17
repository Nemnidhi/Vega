import { z } from "zod";

const serverEnvSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DIRECT_URI: z.string().optional(),
  MONGODB_DNS_SERVERS: z.string().default("1.1.1.1,8.8.8.8"),
  MONGODB_DB_NAME: z.string().min(1, "MONGODB_DB_NAME is required"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  AUTH_TRUST_HOST: z.enum(["true", "false"]).default("true"),
  LEAD_CAPTURE_ALLOWED_ORIGINS: z
    .string()
    .default("https://nemnidhi.com,https://www.nemnidhi.com"),
  // Shared secret for POST /api/integrations/dashboard-events - optional so environments that
  // haven't configured this yet don't fail the whole server env parse; the route itself checks
  // for its presence and rejects the request (not the process) when it's unset.
  DASHBOARD_INTEGRATION_SECRET: z.string().min(16).optional(),
  // Shared secret for /api/client-portal/* - the nemnidhi.com website's backend calls these
  // server-to-server on behalf of its own logged-in client users, same optional-at-parse-time
  // shape as DASHBOARD_INTEGRATION_SECRET above.
  CLIENT_PORTAL_INTEGRATION_SECRET: z.string().min(16).optional(),
  // Where invite-client emails point clients to activate their account - the public website's
  // portal, not this app's own /client/activate (kept working as an internal fallback).
  CLIENT_PORTAL_BASE_URL: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issueMessage = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid server environment variables: ${issueMessage}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

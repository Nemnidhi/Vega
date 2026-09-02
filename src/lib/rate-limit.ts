import { connectToDatabase } from "@/lib/db/mongodb";
import { ApiError } from "@/lib/api/responses";
import { RateLimitEventModel } from "@/models";

/** Best-effort caller IP from the proxy headers. "unknown" buckets everything behind one key. */
export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Records one attempt under `key` and returns whether this attempt is
 * within the allowed rate. Always records the attempt, even a rejected one,
 * so a caller hammering the endpoint doesn't get a free pass by staying
 * just under the limit forever.
 */
export async function checkRateLimit(key: string, { limit, windowMs }: { limit: number; windowMs: number }) {
  await connectToDatabase();

  const windowStart = new Date(Date.now() - windowMs);
  const recentCount = await RateLimitEventModel.countDocuments({ key, createdAt: { $gte: windowStart } });

  await RateLimitEventModel.create({ key });

  return { allowed: recentCount < limit, recentCount };
}

/**
 * Throttle for credential-checking endpoints (login, signup, invite activation, password
 * change). Counts against two independent buckets and rejects on either:
 *
 * - the caller's IP, so one attacker cannot spray attempts across many accounts, and
 * - the submitted identity, so an account cannot be attacked from rotating addresses.
 *
 * Both have to be recorded on every attempt, not just the one that would trip first -
 * short-circuiting on the IP bucket would leave the identity bucket permanently under its
 * limit for a distributed attempt.
 *
 * Throws ApiError(429) rather than returning a flag: every auth route already funnels
 * through handleApiError, so this needs no per-route branching.
 */
export async function assertAuthRateLimit(
  request: Request,
  scope: string,
  identity: string | null | undefined,
  options?: { ipLimit?: number; identityLimit?: number; windowMs?: number },
) {
  const windowMs = options?.windowMs ?? 15 * 60 * 1000;
  const ipLimit = options?.ipLimit ?? 20;
  const identityLimit = options?.identityLimit ?? 8;

  const normalizedIdentity = identity?.trim().toLowerCase();

  const [byIp, byIdentity] = await Promise.all([
    checkRateLimit(`${scope}:ip:${getClientIp(request)}`, { limit: ipLimit, windowMs }),
    normalizedIdentity
      ? checkRateLimit(`${scope}:id:${normalizedIdentity}`, { limit: identityLimit, windowMs })
      : Promise.resolve({ allowed: true, recentCount: 0 }),
  ]);

  if (!byIp.allowed || !byIdentity.allowed) {
    throw new ApiError("Too many attempts. Please wait a few minutes and try again.", 429);
  }
}

import { connectToDatabase } from "@/lib/db/mongodb";
import { RateLimitEventModel } from "@/models";

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

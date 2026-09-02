import dns from "node:dns";
import mongoose from "mongoose";
import { getServerEnv } from "@/lib/env/server";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalCache = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
  mongodbDnsConfigured?: boolean;
};

const cache: MongooseCache = globalCache.mongooseCache ?? {
  conn: null,
  promise: null,
};

globalCache.mongooseCache = cache;

function resolveMongoUris(primaryUri: string, fallbackUri?: string) {
  if (!fallbackUri || fallbackUri === primaryUri) {
    return [primaryUri];
  }

  return [primaryUri, fallbackUri];
}

function applySrvDnsWorkaround(uri: string, dnsServersRaw: string) {
  if (!uri.startsWith("mongodb+srv://") || globalCache.mongodbDnsConfigured) {
    return;
  }

  const dnsServers = dnsServersRaw
    .split(",")
    .map((server) => server.trim())
    .filter((server) => server.length > 0);

  if (dnsServers.length === 0) {
    return;
  }

  try {
    dns.setServers(dnsServers);
    globalCache.mongodbDnsConfigured = true;
  } catch (error) {
    console.warn("MongoDB DNS fallback configuration failed", error);
  }
}

export async function connectToDatabase() {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    const env = getServerEnv();
    const connectionUris = resolveMongoUris(
      env.MONGODB_URI,
      env.MONGODB_DIRECT_URI,
    );

    cache.promise = (async () => {
      let lastError: unknown;

      for (const uri of connectionUris) {
        applySrvDnsWorkaround(uri, env.MONGODB_DNS_SERVERS);

        try {
          return await mongoose.connect(uri, {
            dbName: env.MONGODB_DB_NAME,
            // Building indexes on every cold start is the wrong default for a serving
            // process, but leaving it off in production meant the declared indexes were
            // never created there at all - including the unique ones several modules rely
            // on for correctness (Lead.metaLeadId dedupes Meta webhook redeliveries,
            // Task.code and Task.importFingerprint dedupe generated codes and imported
            // rows, the partial unique index keeps one pending password-change request per
            // user, and the TTL index is what stops RateLimitEvent growing without bound).
            // Production now builds them from `npm run sync:indexes` as a deploy step;
            // MONGODB_AUTO_INDEX=true forces the old inline behaviour when needed.
            autoIndex:
              process.env.MONGODB_AUTO_INDEX === "true" || process.env.NODE_ENV !== "production",
            family: 4,
            maxPoolSize: 10,
            minPoolSize: 0,
            maxIdleTimeMS: 30_000,
            serverSelectionTimeoutMS: 15_000,
          });
        } catch (error) {
          lastError = error;

          if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect().catch(() => undefined);
          }
        }
      }

      throw lastError ?? new Error("Unable to connect to MongoDB");
    })();
  }

  try {
    cache.conn = await cache.promise;
    return cache.conn;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
}

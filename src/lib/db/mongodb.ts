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
            autoIndex: process.env.NODE_ENV !== "production",
            family: 4,
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

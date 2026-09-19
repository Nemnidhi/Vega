import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    // Disable dev filesystem cache to avoid persistent cache compaction/write-batch conflicts
    // when disk is nearly full or cache DB gets locked.
    turbopackFileSystemCacheForDev: false,
  },
  devIndicators: false,
  // @react-pdf/renderer is ESM-only and breaks bundling if webpack tries to
  // process it - it has to stay external and be required at runtime.
  serverExternalPackages: ["@react-pdf/renderer"],
  async headers() {
    return [
      {
        // The push service worker must never be served from cache, or a deploy
        // that changes sw.js leaves phones running the old one indefinitely.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;

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
};

export default nextConfig;

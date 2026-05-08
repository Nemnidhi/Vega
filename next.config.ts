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
};

export default nextConfig;

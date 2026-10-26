import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Photos du catalogue : 2 Mo maximum + marge du multipart.
    serverActions: { bodySizeLimit: "2.2mb" },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Photos du catalogue : 2 Mo maximum + marge du multipart.
    serverActions: { bodySizeLimit: "2.2mb" },
  },
  async headers() {
    return [
      {
        // Suivi client : le jeton est dans l'URL, il ne doit fuiter ni par le
        // Referer, ni dans un index de recherche, ni dans un cache partagé.
        source: "/suivi/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;

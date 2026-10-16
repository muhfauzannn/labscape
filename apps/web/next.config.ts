import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the single agent guide in docs/AGENTS.md instead of generating root files.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [{ source: "/tools/svg", destination: "/start", permanent: true }];
  },
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const apiOrigin = process.env.LABAI_API_ORIGIN ?? "http://localhost:8080";
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;

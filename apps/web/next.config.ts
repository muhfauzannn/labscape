import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the single agent guide in docs/AGENTS.md instead of generating root files.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;

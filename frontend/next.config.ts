import type { NextConfig } from "next";

// API target is env-driven: http://localhost:8001 locally, http://server:8001 in Docker.
const API_PROXY = process.env.API_PROXY || "http://localhost:8001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_PROXY}/api/:path*` }];
  },
};

export default nextConfig;

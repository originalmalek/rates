import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["95.81.118.170"],
  async rewrites() {
    const apiBase = process.env.API_URL ?? "http://localhost:8000";
    return [
      { source: "/api/:path*", destination: `${apiBase}/:path*` },
    ];
  },
};

export default nextConfig;

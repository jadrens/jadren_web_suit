import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: "build",
  allowedDevOrigins: [
    "jadren.debug",
  ],
  // public/ files are not content-hashed, so cache them for a bounded time instead of `immutable`.
  async headers() {
    return [
      {
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=31536000" }],
      },
      {
        source: "/:file(avatar\\.webp|favicon\\.ico|favicon-512\\.png)",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/:dir(icons|backgrounds)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
  experimental: {
    workerThreads: process.env.CI ? false : undefined,
    cpus: process.env.CI ? 1 : undefined,
  },
};

export default nextConfig;

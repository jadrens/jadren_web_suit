import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: "build",
  allowedDevOrigins: [
    "jadren.debug",
  ],
  experimental: {
    workerThreads: process.env.CI ? false : undefined,
    cpus: process.env.CI ? 1 : undefined,
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/blog/:path*", destination: "/sites/blog/blog/:path*" },
        { source: "/about", destination: "/sites/blog/about" },
        { source: "/editor/:path*", destination: "/sites/blog/editor/:path*" },
        { source: "/admin/:path*", destination: "/sites/blog/admin/:path*" },
        { source: "/api/search/:path*", destination: "/sites/blog/api/search/:path*" },
        { source: "/api/editor/:path*", destination: "/sites/blog/api/editor/:path*" },
        { source: "/api/admin/:path*", destination: "/sites/blog/api/admin/:path*" },
        { source: "/tools/:path*", destination: "/sites/tool/tools/:path*" },
        { source: "/mtools/:path*", destination: "/sites/tool/mtools/:path*" },
        { source: "/user-status", destination: "/sites/tool/user-status" },
        { source: "/user-data", destination: "/sites/tool/user-data" },
        { source: "/api/dns/:path*", destination: "/sites/tool/api/dns/:path*" },
        { source: "/api/dns-leak/:path*", destination: "/sites/tool/api/dns-leak/:path*" },
        { source: "/api/ip/:path*", destination: "/sites/tool/api/ip/:path*" },
        { source: "/api/ip-geo/:path*", destination: "/sites/tool/api/ip-geo/:path*" },
        { source: "/api/quick-links/:path*", destination: "/sites/tool/api/quick-links/:path*" },
        { source: "/api/reminders/:path*", destination: "/sites/tool/api/reminders/:path*" },
        { source: "/api/vocabulary-practice/:path*", destination: "/sites/tool/api/vocabulary-practice/:path*" },
        { source: "/api/vocabulary-drill/:path*", destination: "/sites/tool/api/ncee-vocabulary/:path*" },
        { source: "/api/auth/:path*", destination: "/sites/main/api/auth/:path*" },
        { source: "/settings/:path*", destination: "/sites/main/settings/:path*" },
        { source: "/login", destination: "/sites/main/login" },
        { source: "/register", destination: "/sites/main/register" },
        { source: "/verify-email", destination: "/sites/main/verify-email" },
        { source: "/robots.txt", destination: "/sites/main/robots.txt" },
        { source: "/sitemap.xml", destination: "/sites/main/sitemap.xml" },
        { source: "/", destination: "/sites/main" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;

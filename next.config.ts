import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Next.js and the theme bootstrap emit inline scripts, and MUI/Emotion inject
// inline styles, so both need 'unsafe-inline'; everything else is restricted.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Blog images, avatars and the DNS leak test's probe images may be on any HTTPS host.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // The LLM tools call user-configured HTTPS endpoints, or a local model server.
  `connect-src 'self' https: http://localhost:* http://127.0.0.1:*${isDev ? " ws: wss:" : ""}`,
  // Dictionary pronunciations come from third-party HTTPS hosts.
  "media-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// HSTS is sent by nginx, which owns TLS for each site.
const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The dictionary's speech input needs the microphone; nothing needs the rest.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  distDir: "build",
  allowedDevOrigins: [
    "jadren.debug",
  ],
  // public/ files are not content-hashed, so cache them for a bounded time instead of `immutable`.
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=31536000" }],
      },
      {
        source: "/:file(avatar\\.webp|favicon\\.ico|favicon-512\\.png)",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/:dir(icons|backgrounds|mathlive|vditor)/:path*",
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

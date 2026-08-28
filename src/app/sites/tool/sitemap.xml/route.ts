import { NextResponse } from "next/server";
import SITE_CONFIG from "@tool/var/config";

const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";

// Keep this list limited to public, indexable pages. Account pages and the
// internal DNS manager are intentionally not part of the public sitemap.
const PUBLIC_ROUTES = [
  { path: "/", priority: "1.0" },
  { path: "/tools", priority: "0.8" },
  { path: "/tools/base64", priority: "0.7" },
  { path: "/tools/colour-picker", priority: "0.7" },
  { path: "/tools/dns", priority: "0.7" },
  { path: "/tools/dns-leak", priority: "0.7" },
  { path: "/tools/ip", priority: "0.7" },
  { path: "/tools/qrcode", priority: "0.7" },
  { path: "/tools/quick-link", priority: "0.7" },
] as const;

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });
}

function buildUrl(path: string): string {
  // URL also normalizes the configured origin and percent-encodes path data.
  return new URL(path, SITE_CONFIG.baseUrl).toString();
}

export function GET() {
  const entries = PUBLIC_ROUTES.map(
    ({ path, priority }) => `  <url>
    <loc>${escapeXml(buildUrl(path))}</loc>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
  </url>`,
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="${SITEMAP_NAMESPACE}">
${entries}
</urlset>
`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // The URL list is static; avoid serving a stale response after a deploy.
      "Cache-Control": "public, max-age=0, s-maxage=3600, must-revalidate",
    },
  });
}

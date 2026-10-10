import SITE_CONFIG from "@config/app/config";

const ROBOTS = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /rpc/

Sitemap: ${SITE_CONFIG.baseUrl}/sitemap.xml
`;

export function GET() {
  return new Response(ROBOTS, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

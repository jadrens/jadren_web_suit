const ROBOTS = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://blog.jadren.me/sitemap.xml
`;

export function GET() {
  return new Response(ROBOTS, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

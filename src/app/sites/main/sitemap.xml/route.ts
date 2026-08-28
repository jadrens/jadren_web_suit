import { NextResponse } from "next/server";

function formatSitemapDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://blog.jadren.me/sitemap.xml</loc>
    <lastmod>${formatSitemapDate(new Date())}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://tool.jadren.me/sitemap.xml</loc>
    <lastmod>${formatSitemapDate(new Date())}</lastmod>
  </sitemap>
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}

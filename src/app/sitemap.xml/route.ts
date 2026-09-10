import { NextResponse } from "next/server";
import SITE_CONFIG from "@config/app/config";
import { getAllPostMetas, Locale } from "@lib/publishing/posts";

const STATIC_PATHS = [
  "/",
  "/about",
  "/tools",
  "/tools/base64",
  "/tools/colour-picker",
  "/tools/dictionary",
  "/tools/dns",
  "/tools/dns-leak",
  "/tools/english-learner",
  "/tools/english-learner/ai-center",
  "/tools/english-learner/grammar-checker",
  "/tools/english-learner/sentence-practice",
  "/tools/english-learner/vocabulary-practice",
  "/tools/ip",
  "/tools/qrcode",
  "/tools/quick-link",
  "/tools/reminder",
];

interface SitemapEntry {
  path: string;
  lastmod?: string;
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] || character);
}

export async function GET() {
  const locales: Locale[] = ["en", "zh"];
  const posts = await Promise.all(locales.map((locale) => getAllPostMetas(locale)));
  const sitemapEntries: SitemapEntry[] = [
    ...STATIC_PATHS.map((path) => ({ path })),
    ...locales.flatMap((locale, index) => [
      { path: `/blog/${locale}` },
      ...posts[index].map((post) => ({ path: `/blog/${locale}/${post.slug}`, lastmod: post.date })),
    ]),
  ]
  const entries = sitemapEntries.map(({ path, lastmod }) => {
      const lastmodXml = lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : "";
      return `  <url><loc>${escapeXml(new URL(path, SITE_CONFIG.baseUrl).toString())}</loc>${lastmodXml}</url>`;
    })
    .join("\n");

  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

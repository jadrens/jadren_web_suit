import { NextResponse } from "next/server";
import { getAllPostMetas, Locale } from "@shared/libs/blog/posts";

const ORIGIN = "https://jadren.me";
const STATIC_PATHS = ["/", "/about", "/tools", "/tools/base64", "/tools/colour-picker", "/tools/dns", "/tools/dns-leak", "/tools/english-learner", "/tools/ip", "/tools/qrcode", "/tools/quick-link", "/tools/reminder"];

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] || character);
}

export async function GET() {
  const locales: Locale[] = ["en", "zh"];
  const posts = await Promise.all(locales.map((locale) => getAllPostMetas(locale)));
  const paths = [...STATIC_PATHS];
  locales.forEach((locale, index) => paths.push(`/blog/${locale}`, ...posts[index].map((post) => `/blog/${locale}/${post.slug}`)));
  const entries = paths.map((path) => `  <url><loc>${escapeXml(new URL(path, ORIGIN).toString())}</loc></url>`).join("\n");
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

import { MetadataRoute } from "next";
import { getAllPostMetas, Locale } from "@shared/libs/blog/posts";
import { SITE_CONFIG } from "@blog/var/config";

const locales: Locale[] = ["en", "zh"];

function formatSitemapDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const allPages: MetadataRoute.Sitemap = [
    {
      url: SITE_CONFIG.baseUrl,
      lastModified: formatSitemapDate(new Date()),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_CONFIG.baseUrl}/about`,
      lastModified: formatSitemapDate(new Date()),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const postsByLocale = await Promise.all(
    locales.map((locale) => getAllPostMetas(locale))
  );

  // Add blog pages for each locale
  for (const [index, locale] of locales.entries()) {
    allPages.push({
      url: `${SITE_CONFIG.baseUrl}/blog/${locale}`,
      lastModified: formatSitemapDate(new Date()),
      changeFrequency: "weekly",
      priority: 0.9,
    });

    const posts = postsByLocale[index];
    const postPages = posts.map((post) => ({
      url: `${SITE_CONFIG.baseUrl}/blog/${locale}/${post.slug}`,
      lastModified: formatSitemapDate(new Date(post.date)),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));
    allPages.push(...postPages);
  }

  return allPages;
}

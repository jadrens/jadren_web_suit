"use server";

import { headers } from "next/headers";
import { getAllPosts, getPostSlugs, Locale } from "@lib/publishing/posts";
import { getAllPostViews, getPostViews } from "@lib/publishing/db";
import { incrementPostViews } from "@lib/publishing/db";
import { requestIp } from "@lib/auth/email-send-rate-limit";
import { sharedLimiter } from "@lib/rate-limit/sqlite-window";

const LOCALES: Locale[] = ["en", "zh"];

// One counted view per visitor and post per window: reloads and repeated calls
// to this public action do not inflate the count.
const viewLimiter = () => sharedLimiter("blog_post_view_hits", [{ windowMs: 30 * 60_000, limit: 1 }]);

export async function getPosts(locale: Locale) {
  return getAllPosts(locale);
}

export async function getPostView(slug: string) {
  return getPostViews(slug);
}

export async function getAllViews() {
  return getAllPostViews();
}

export async function incrementView(slug: string): Promise<void> {
  if (typeof slug !== "string" || slug.length > 200) return;
  // Only existing posts get a row; anything else would grow blog_post_view without bound.
  const known = await Promise.all(LOCALES.map(async (locale) => (await getPostSlugs(locale)).includes(slug)));
  if (!known.some(Boolean)) return;
  const ip = requestIp({ headers: await headers() });
  if (!viewLimiter().consume(`${ip}:${slug}`)) return;
  await incrementPostViews(slug);
}

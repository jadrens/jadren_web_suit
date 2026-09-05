import { db } from "@lib/auth/db";
import type { PostMeta } from "./search-index";
import { cache } from "react";
import { unstable_cache } from "next/cache";

export type Locale = "en" | "zh";

export interface Post {
  postId: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  content: string;
  tags: string[];
  locale: Locale;
}

interface PostRow {
  post_id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  published_at: Date | string;
  locale: Locale;
  tags: string[] | null;
}

const postSelect = `
  SELECT p.post_id, p.slug, p.title, p.description, p.content,
         p.published_at, p.locale,
         COALESCE(array_agg(t.tag ORDER BY t.tag)
           FILTER (WHERE t.tag IS NOT NULL), ARRAY[]::varchar[]) AS tags
    FROM blog_post p
    LEFT JOIN blog_post_tag t ON t.post_id = p.post_id`;

function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toPost(row: PostRow): Post {
  return {
    postId: row.post_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    date: isoDate(row.published_at),
    content: row.content,
    tags: row.tags ?? [],
    locale: row.locale,
  };
}

export async function getPostSlugs(locale: Locale): Promise<string[]> {
  return (await getAllPostMetas(locale)).map((post) => post.slug);
}

async function loadPostBySlug(slug: string, locale: Locale): Promise<Post | null> {
  const result = await db.query<PostRow>(
    `${postSelect}
      WHERE p.locale = $1 AND p.slug = $2
      GROUP BY p.post_id
      LIMIT 1`,
    [locale, slug]
  );
  return result.rows[0] ? toPost(result.rows[0]) : null;
}

async function loadAllPosts(locale: Locale): Promise<Post[]> {
  const result = await db.query<PostRow>(
    `${postSelect}
      WHERE p.locale = $1
      GROUP BY p.post_id
      ORDER BY p.published_at DESC`,
    [locale]
  );
  return result.rows.map(toPost);
}

async function loadAllPostMetas(locale: Locale): Promise<PostMeta[]> {
  const result = await db.query<Omit<PostRow, "content">>(
    `SELECT p.post_id, p.slug, p.title, p.description,
            p.published_at, p.locale,
            COALESCE(array_agg(t.tag ORDER BY t.tag)
              FILTER (WHERE t.tag IS NOT NULL), ARRAY[]::varchar[]) AS tags
       FROM blog_post p
       LEFT JOIN blog_post_tag t ON t.post_id = p.post_id
      WHERE p.locale = $1
      GROUP BY p.post_id
      ORDER BY p.published_at DESC`,
    [locale]
  );
  return result.rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    description: row.description,
    date: isoDate(row.published_at),
    tags: row.tags ?? [],
    locale: row.locale,
  }));
}

const cacheOptions = { tags: ["blog-posts"], revalidate: 300 };
const getCachedPostBySlug = unstable_cache(loadPostBySlug, ["blog-post-by-slug"], cacheOptions);
const getCachedAllPosts = unstable_cache(loadAllPosts, ["blog-post-list"], cacheOptions);
const getCachedAllPostMetas = unstable_cache(loadAllPostMetas, ["blog-post-meta-list"], cacheOptions);

// React cache deduplicates within one render; Next's data cache avoids a remote
// database round trip across requests. Publishing invalidates the shared tag.
export const getPostBySlug = cache(getCachedPostBySlug);
export const getAllPosts = cache(getCachedAllPosts);
export const getAllPostMetas = cache(getCachedAllPostMetas);

export interface AdjacentPosts {
  prev: PostMeta | null;
  next: PostMeta | null;
}

export function getAdjacentPosts(slug: string, posts: PostMeta[]): AdjacentPosts {
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return { prev: posts[index - 1] ?? null, next: posts[index + 1] ?? null };
}

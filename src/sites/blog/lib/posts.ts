import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { getSearchIndex, PostMeta } from "./search-index";

export type Locale = "en" | "zh";

function getPostsDirectory(locale: Locale): string {
  return path.join(process.cwd(), `content/posts/${locale}`);
}

export interface Post {
  slug: string;
  title: string;
  date: string;
  content: string;
  tags: string[];
}

export function getPostSlugs(locale: Locale): string[] {
  const index = getSearchIndex(locale);
  return index.postsByDate.map((p) => p.slug);
}

export function getPostBySlug(slug: string, locale: Locale): Post {
  const meta = getSearchIndex(locale).postsByDate.find((p) => p.slug === slug);
  if (!meta) {
    return { slug, title: "Not Found", date: "", content: "", tags: [] };
  }

  const postsDirectory = getPostsDirectory(locale);
  const fullPath = path.join(postsDirectory, `${slug}.md`);

  try {
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { content } = matter(fileContents);

    return {
      slug: meta.slug,
      title: meta.title,
      date: meta.date,
      content,
      tags: meta.tags,
    };
  } catch {
    return { slug, title: "Not Found", date: "", content: "", tags: [] };
  }
}

export function getAllPosts(locale: Locale): Post[] {
  const index = getSearchIndex(locale);
  const posts: Post[] = [];
  for (const meta of index.postsByDate) {
    const fullPath = path.join(getPostsDirectory(locale), `${meta.slug}.md`);
    try {
      const fileContents = fs.readFileSync(fullPath, "utf8");
      const { content } = matter(fileContents);
      posts.push({
        slug: meta.slug,
        title: meta.title,
        date: meta.date,
        content,
        tags: meta.tags,
      });
    } catch {
      // File was deleted or unreadable — skip it (index will be regenerated)
      continue;
    }
  }
  return posts;
}

export interface AdjacentPosts {
  prev: PostMeta | null;
  next: PostMeta | null;
}

export function getAdjacentPosts(slug: string, locale: Locale): AdjacentPosts {
  const index = getSearchIndex(locale);
  const posts = index.postsByDate;
  const idx = posts.findIndex((p) => p.slug === slug);
  if (idx === -1) {
    return { prev: null, next: null };
  }
  return {
    prev: posts[idx - 1] ?? null,
    next: posts[idx + 1] ?? null,
  };
}
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { Locale } from "./posts";

const dataDir = path.join(process.cwd(), "data");
const searchIndexDir = path.join(dataDir, "search-index");

export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  locale: Locale;
}

export interface SearchIndex {
  version: number;
  generatedAt: string;
  postsByDate: PostMeta[];
  postsByTag: Record<string, PostMeta[]>;
}

function getContentDir(locale: Locale): string {
  return path.join(process.cwd(), `content/posts/${locale}`);
}

function getIndexPath(locale: Locale): string {
  return path.join(searchIndexDir, `index-${locale}.json`);
}

function ensureDataDir(): void {
  if (!fs.existsSync(searchIndexDir)) {
    fs.mkdirSync(searchIndexDir, { recursive: true });
  }
}

function getContentMtime(locale: Locale): number {
  const contentDir = getContentDir(locale);
  if (!fs.existsSync(contentDir)) return 0;

  const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".md"));
  let latestMtime = 0;
  for (const file of files) {
    const stat = fs.statSync(path.join(contentDir, file));
    if (stat.mtimeMs > latestMtime) latestMtime = stat.mtimeMs;
  }
  return latestMtime;
}

function writeMissingFrontmatter(
  filePath: string,
  content: string,
  fields: Record<string, unknown>,
): boolean {
  try {
    const parsed = matter(content);
    Object.assign(parsed.data, fields);
    const updated = matter.stringify(parsed.content, parsed.data);
    fs.writeFileSync(filePath, updated);
    return true;
  } catch {
    return false;
  }
}

function parsePostMeta(filePath: string, locale: Locale): PostMeta | null {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const { data } = matter(content);
    const slug = path.basename(filePath, ".md");
    const title = data.title || "Untitled";

    const missingFields: Record<string, unknown> = {};

    let date: string;
    if (data.date) {
      date = new Date(data.date).toISOString();
    } else {
      date = new Date().toISOString();
      missingFields.date = date;
    }

    let description: string;
    if (data.description) {
      description = data.description;
    } else {
      description = title;
      missingFields.description = description;
    }

    if (Object.keys(missingFields).length > 0) {
      writeMissingFrontmatter(filePath, content, missingFields);
    }

    return {
      slug,
      title,
      description,
      date,
      tags: data.tags || [],
      locale,
    };
  } catch {
    return null;
  }
}

function generateIndex(locale: Locale): SearchIndex {
  const contentDir = getContentDir(locale);
  if (!fs.existsSync(contentDir)) {
    return { version: 1, generatedAt: new Date().toISOString(), postsByDate: [], postsByTag: {} };
  }

  const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".md"));
  const posts: PostMeta[] = [];

  for (const file of files) {
    const filePath = path.join(contentDir, file);
    const meta = parsePostMeta(filePath, locale);
    if (meta) posts.push(meta);
  }

  // Sort by date descending (newest first)
  posts.sort((a, b) => (a.date < b.date ? 1 : -1));

  // Build tag index
  const postsByTag: Record<string, PostMeta[]> = {};
  for (const post of posts) {
    for (const tag of post.tags) {
      if (!postsByTag[tag]) postsByTag[tag] = [];
      postsByTag[tag].push(post);
    }
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    postsByDate: posts,
    postsByTag,
  };
}

function loadIndex(locale: Locale): SearchIndex | null {
  const indexPath = getIndexPath(locale);
  if (!fs.existsSync(indexPath)) return null;

  try {
    const content = fs.readFileSync(indexPath, "utf8");
    return JSON.parse(content) as SearchIndex;
  } catch {
    return null;
  }
}

function saveIndex(locale: Locale, index: SearchIndex): void {
  ensureDataDir();
  const indexPath = getIndexPath(locale);
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

function needsRegeneration(locale: Locale): boolean {
  const index = loadIndex(locale);
  if (!index) return true;

  // Check for file additions/deletions by comparing slug sets
  const contentDir = getContentDir(locale);
  const diskFiles = fs.existsSync(contentDir)
    ? fs.readdirSync(contentDir).filter((f) => f.endsWith(".md"))
    : [];
  const diskSlugs = new Set(diskFiles.map((f) => path.basename(f, ".md")));
  const indexSlugs = new Set(index.postsByDate.map((p) => p.slug));

  if (diskSlugs.size !== indexSlugs.size) return true;
  for (const slug of diskSlugs) {
    if (!indexSlugs.has(slug)) return true;
  }

  // Check for content modifications (mtime)
  const contentMtime = getContentMtime(locale);
  const indexMtime = fs.statSync(getIndexPath(locale)).mtimeMs;

  return contentMtime > indexMtime;
}

export function getSearchIndex(locale: Locale, forceRefresh = false): SearchIndex {
  if (!forceRefresh && !needsRegeneration(locale)) {
    const index = loadIndex(locale);
    if (index) return index;
  }

  const index = generateIndex(locale);
  saveIndex(locale, index);
  return index;
}

export function getPostMeta(slug: string, locale: Locale): PostMeta | null {
  const index = getSearchIndex(locale);
  return index.postsByDate.find((p) => p.slug === slug) || null;
}

export function getPostsByTag(tag: string, locale: Locale): PostMeta[] {
  const index = getSearchIndex(locale);
  return index.postsByTag[tag] || [];
}

export function getAllTags(locale: Locale): string[] {
  const index = getSearchIndex(locale);
  return Object.keys(index.postsByTag);
}

export function getAllPostsMeta(locale: Locale): PostMeta[] {
  const index = getSearchIndex(locale);
  return index.postsByDate;
}

// Regenerate index for all locales
export function regenerateAllIndexes(): void {
  for (const locale of ["en", "zh"] as Locale[]) {
    const index = generateIndex(locale);
    saveIndex(locale, index);
  }
}
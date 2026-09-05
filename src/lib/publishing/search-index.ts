import { getAllPostMetas, type Locale } from "./posts";

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

export async function getSearchIndex(locale: Locale): Promise<SearchIndex> {
  const postsByDate = await getAllPostMetas(locale);
  const postsByTag: Record<string, PostMeta[]> = {};
  for (const post of postsByDate) {
    for (const tag of post.tags) (postsByTag[tag] ??= []).push(post);
  }
  return { version: 2, generatedAt: new Date().toISOString(), postsByDate, postsByTag };
}

export async function getPostMeta(slug: string, locale: Locale) {
  return (await getSearchIndex(locale)).postsByDate.find((post) => post.slug === slug) ?? null;
}

export async function getPostsByTag(tag: string, locale: Locale) {
  return (await getSearchIndex(locale)).postsByTag[tag] ?? [];
}

export async function getAllTags(locale: Locale) {
  return Object.keys((await getSearchIndex(locale)).postsByTag);
}

export async function getAllPostsMeta(locale: Locale) {
  return (await getSearchIndex(locale)).postsByDate;
}

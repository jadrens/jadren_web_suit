import { getAllPostMetas, type Locale } from "./posts";
import { cache } from "react";
import { indexPostsByTag } from "./post-tags";

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

export const getSearchIndex = cache(async (locale: Locale): Promise<SearchIndex> => {
  const postsByDate = await getAllPostMetas(locale);
  const postsByTag = indexPostsByTag(postsByDate);
  return { version: 2, generatedAt: new Date().toISOString(), postsByDate, postsByTag };
});

export async function getPostMeta(slug: string, locale: Locale) {
  return (await getAllPostMetas(locale)).find((post) => post.slug === slug) ?? null;
}

export async function getPostsByTag(tag: string, locale: Locale) {
  return (await getSearchIndex(locale)).postsByTag[tag] ?? [];
}

export async function getAllTags(locale: Locale) {
  return Object.keys((await getSearchIndex(locale)).postsByTag);
}

export async function getAllPostsMeta(locale: Locale) {
  return getAllPostMetas(locale);
}

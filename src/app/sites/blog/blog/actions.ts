"use server";

import { getAllPosts, Locale } from "@shared/libs/blog/posts";
import { getAllPostViews, getPostViews } from "@shared/libs/blog/db";
import { incrementPostViews } from "@shared/libs/blog/db";

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
  await incrementPostViews(slug);
}
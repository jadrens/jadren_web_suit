"use server";

import { getAllPosts, Locale } from "@lib/publishing/posts";
import { getAllPostViews, getPostViews } from "@lib/publishing/db";
import { incrementPostViews } from "@lib/publishing/db";

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
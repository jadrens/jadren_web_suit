import { NextRequest, NextResponse } from "next/server";
import { getSearchIndex, getAllTags } from "@blog/lib/search-index";
import { Locale } from "@blog/lib/posts";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const locale = (searchParams.get("locale") || "en") as Locale;

  if (!query.trim()) {
    return NextResponse.json({ results: [], tags: getAllTags(locale) });
  }

  const index = getSearchIndex(locale);
  const keyword = query.toLowerCase();

  const results = index.postsByDate.filter(
    (post) =>
      post.title.toLowerCase().includes(keyword) ||
      post.tags.some((tag) => tag.toLowerCase().includes(keyword))
  );

  return NextResponse.json({ results, tags: getAllTags(locale) });
}
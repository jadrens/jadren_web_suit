import { NextRequest, NextResponse } from "next/server";
import { getSearchIndex, getAllTags } from "@shared/libs/blog/search-index";
import { Locale } from "@shared/libs/blog/posts";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const locale = (searchParams.get("locale") || "en") as Locale;

  if (!query.trim()) {
    return NextResponse.json({ results: [], tags: await getAllTags(locale) });
  }

  const index = await getSearchIndex(locale);
  const keyword = query.toLowerCase();

  const results = index.postsByDate.filter(
    (post) =>
      post.title.toLowerCase().includes(keyword) ||
      post.tags.some((tag) => tag.toLowerCase().includes(keyword))
  );

  return NextResponse.json({ results, tags: await getAllTags(locale) });
}

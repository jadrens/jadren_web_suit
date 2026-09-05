import { db } from "@lib/auth/db";
import { unstable_cache } from "next/cache";

interface ViewCountRow {
  slug: string;
  view_count: string | number | bigint;
}

function viewCount(value: ViewCountRow["view_count"] | undefined) {
  if (value === undefined) return 0;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

async function loadPostViews(slug: string): Promise<number> {
  const result = await db.query<Pick<ViewCountRow, "view_count">>(
    "SELECT view_count FROM blog_post_view WHERE slug = $1 LIMIT 1",
    [slug]
  );
  return viewCount(result.rows[0]?.view_count);
}

export const getPostViews = unstable_cache(
  loadPostViews,
  ["blog-post-views"],
  { revalidate: 30 }
);

export async function incrementPostViews(slug: string): Promise<void> {
  await db.query(
    `INSERT INTO blog_post_view (slug, view_count)
     VALUES ($1, 1)
     ON CONFLICT (slug) DO UPDATE
       SET view_count = blog_post_view.view_count + 1,
           updated_at = NOW()`,
    [slug]
  );
}

async function loadAllPostViews(): Promise<Record<string, number>> {
  const result = await db.query<ViewCountRow>(
    "SELECT slug, view_count FROM blog_post_view"
  );
  return Object.fromEntries(
    result.rows.map((row) => [row.slug, viewCount(row.view_count)])
  );
}

export const getAllPostViews = unstable_cache(
  loadAllPostViews,
  ["all-blog-post-views"],
  { revalidate: 30 }
);

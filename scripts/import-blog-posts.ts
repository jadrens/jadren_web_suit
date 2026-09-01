import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { closeDb, withTransaction } from "../src/shared/libs/auth/db";

const locales = ["en", "zh"] as const;
let imported = 0;

try {
  for (const locale of locales) {
    const directory = path.join(process.cwd(), "content", "posts", locale);
    const files = (await readdir(directory)).filter((file) => file.endsWith(".md"));
    for (const file of files) {
      const source = await readFile(path.join(directory, file), "utf8");
      const parsed = matter(source);
      const slug = path.basename(file, ".md").toLowerCase();
      const title = String(parsed.data.title || slug);
      const description = String(parsed.data.description || title);
      const publishedAt = parsed.data.date ? new Date(parsed.data.date) : new Date();
      const tags = Array.isArray(parsed.data.tags)
        ? [...new Set(parsed.data.tags.map((tag) => String(tag).trim()).filter(Boolean))]
        : [];

      await withTransaction(async (client) => {
        const result = await client.query<{ post_id: string }>(
          `INSERT INTO blog_post
            (post_id, locale, slug, title, description, content, published_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (locale, slug) DO UPDATE SET
             title = EXCLUDED.title,
             description = EXCLUDED.description,
             content = EXCLUDED.content,
             published_at = EXCLUDED.published_at,
             updated_at = NOW()
           RETURNING post_id`,
          [crypto.randomUUID(), locale, slug, title, description, parsed.content, publishedAt]
        );
        const postId = result.rows[0].post_id;
        await client.query("DELETE FROM blog_post_tag WHERE post_id = $1", [postId]);
        for (const tag of tags) {
          await client.query("INSERT INTO blog_post_tag (post_id, tag) VALUES ($1, $2)", [postId, tag]);
        }
      });
      imported++;
    }
  }
  console.info(`Imported ${imported} Markdown articles into PostgreSQL.`);
} finally {
  await closeDb();
}

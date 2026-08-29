import { existsSync } from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";
import {
  closeDb,
  withTransaction,
} from "../src/sites/tool/lib/auth/db";

interface LegacyViewRow {
  slug: string;
  count: number;
}

const legacyPath = process.env.LEGACY_BLOG_VIEWS_DB?.trim() ||
  path.join(process.cwd(), "data", "views.db");

try {
  if (!existsSync(legacyPath)) {
    console.info(`No legacy blog view database found at ${legacyPath}; nothing to import.`);
  } else {
    const legacyDb = new Database(legacyPath, { readonly: true });
    let rows: LegacyViewRow[];
    try {
      rows = legacyDb.query("SELECT slug, count FROM views").all() as LegacyViewRow[];
    } finally {
      legacyDb.close();
    }

    const validRows = rows.filter(
      (row) =>
        typeof row.slug === "string" &&
        row.slug.trim().length > 0 &&
        Number.isSafeInteger(row.count) &&
        row.count >= 0
    );

    await withTransaction(async (client) => {
      for (const row of validRows) {
        await client.query(
          `INSERT INTO blog_post_view (slug, view_count)
           VALUES ($1, $2)
           ON CONFLICT (slug) DO UPDATE
             SET view_count = GREATEST(blog_post_view.view_count, EXCLUDED.view_count),
                 updated_at = CASE
                   WHEN EXCLUDED.view_count > blog_post_view.view_count THEN NOW()
                   ELSE blog_post_view.updated_at
                 END`,
          [row.slug.trim(), row.count]
        );
      }
    });

    const total = validRows.reduce((sum, row) => sum + row.count, 0);
    console.info(`Imported ${validRows.length} blog view records (${total} total legacy views).`);
    if (validRows.length !== rows.length) {
      console.warn(`Skipped ${rows.length - validRows.length} invalid legacy view records.`);
    }
  }
} finally {
  await closeDb();
}

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "views.db");

mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath, { create: true });

db.run(`
  CREATE TABLE IF NOT EXISTS views (
    slug TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0
  )
`);

// 预编译语句
const selectViews = db.query("SELECT count FROM views WHERE slug = ?");
const insertView = db.query("INSERT INTO views (slug, count) VALUES (?, 1)");
const updateView = db.query("UPDATE views SET count = count + 1 WHERE slug = ?");
const selectAllViews = db.query("SELECT slug, count FROM views");

export function getPostViews(slug: string): number {
  const result = selectViews.get(slug) as { count: number } | null;
  return result?.count ?? 0;
}

export function incrementPostViews(slug: string): void {
  const result = selectViews.get(slug);
  
  if (result === null) {
    insertView.run(slug);
  } else {
    updateView.run(slug);
  }
}

export function getAllPostViews(): Record<string, number> {
  const rows = selectAllViews.all() as Array<{ slug: string; count: number }>;
  return Object.fromEntries(rows.map(r => [r.slug, r.count]));
}
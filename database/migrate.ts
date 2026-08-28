import { readdir, readFile } from "node:fs/promises";
import { closeDb, withTransaction } from "../src/sites/tool/lib/auth/db";

async function migrate() {
  const migrationsUrl = new URL("./migrations/", import.meta.url);
  const migrationFiles = (await readdir(migrationsUrl))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = await readFile(new URL(file, migrationsUrl), "utf8");
    await withTransaction((client) => client.query(sql));
    console.info(`Applied database migration: ${file}`);
  }
}

try {
  await migrate();
} finally {
  await closeDb();
}

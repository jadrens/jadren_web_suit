import { readFile } from "node:fs/promises";
import { closeDb, withTransaction } from "../src/lib/auth/db";

try {
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await withTransaction((client) => client.query(schema));
  console.info("Database schema ready.");
} finally {
  await closeDb();
}

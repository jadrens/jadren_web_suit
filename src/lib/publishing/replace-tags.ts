import type { QueryClient } from "@lib/auth/db";

export async function replaceTags(
  client: QueryClient,
  table: "blog_post_tag" | "blog_post_pending_tag",
  id: string,
  tags: readonly string[]
) {
  const idColumn = table === "blog_post_tag" ? "post_id" : "pending_id";
  await client.query(`DELETE FROM ${table} WHERE ${idColumn} = $1`, [id]);
  if (tags.length === 0) return;
  const values = tags.map((_, index) => `($1, $${index + 2})`).join(", ");
  // Keep every author-supplied value bound, while using one remote round trip
  // for all tags instead of one INSERT per tag inside the transaction.
  await client.query(`INSERT INTO ${table} (${idColumn}, tag) VALUES ${values}`, [id, ...tags]);
}

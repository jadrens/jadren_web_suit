import { databaseJsonArray, databaseJsonObject } from "./database-json";
import { withTransaction } from "@lib/auth/db";
import { collectionOrder, orderExpired, type ReviewItem } from "./collection-order";

export async function refreshCollectionOrders(userId: string, forceCollectionId?: string) {
  return withTransaction(async client => {
    // Serialize snapshot creation so simultaneous clients receive the same order.
    const collections = await client.query<{ collection_id: string; practice_order: unknown; order_generated_at: Date | null }>(
      "SELECT collection_id,practice_order,order_generated_at FROM vocabulary_collection WHERE user_id=$1 ORDER BY collection_id FOR UPDATE", [userId]);
    if (forceCollectionId && !collections.rows.some(c => c.collection_id === forceCollectionId)) return false;
    const now = Date.now();
    for (const c of collections.rows) {
      const regenerate = c.collection_id === forceCollectionId || orderExpired(c.order_generated_at, now);
      const items = await client.query<Omit<ReviewItem, "memory_card"> & { memory_card: unknown }>("SELECT dataset,source_word_id,correct_count,wrong_count,last_reviewed_at,created_at,memory_card FROM vocabulary_collection_item WHERE collection_id=$1 ORDER BY created_at,dataset,source_word_id", [c.collection_id]);
      const saved = databaseJsonArray<string>(c.practice_order);
      const order = collectionOrder(items.rows.map(item => ({ ...item, memory_card: databaseJsonObject<NonNullable<ReviewItem["memory_card"]>>(item.memory_card) })), saved, regenerate, now);
      if (regenerate || JSON.stringify(order) !== JSON.stringify(saved)) await client.query(
        "UPDATE vocabulary_collection SET practice_order=$2::jsonb,order_generated_at=$3 WHERE collection_id=$1",
        [c.collection_id, JSON.stringify(order), regenerate ? new Date(now) : c.order_generated_at]);
    }
    return true;
  });
}

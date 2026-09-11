import { databaseJsonArray, databaseJsonObject } from "./database-json";
import { withTransaction } from "@lib/auth/db";
import { initialMemory, mergeReviews, replayReviews, type MemoryItem, type ReviewEvent } from "./collection-memory";
import type { CardInput } from "ts-fsrs";

interface StatDelta {
  collectionId: string; dataset: string; sourceWordId: number;
  appearances: number; correct: number; wrong: number;
  lastReviewedAt: string | null; reviews?: ReviewEvent[];
}

export async function saveCollectionStats(userId: string, deltas: StatDelta[]) {
  await withTransaction(async client => {
    const ordered = [...deltas].sort((a, b) => `${a.collectionId}:${a.dataset}:${a.sourceWordId}`.localeCompare(`${b.collectionId}:${b.dataset}:${b.sourceWordId}`));
    for (const delta of ordered) {
      const result = await client.query<Omit<MemoryItem, "memory_card"> & { memory_card: unknown; review_seed: unknown; review_history: unknown }>(
        `SELECT i.correct_count,i.wrong_count,i.last_reviewed_at,i.created_at,i.memory_card,i.review_seed,i.review_history
         FROM vocabulary_collection_item i JOIN vocabulary_collection c USING(collection_id)
         WHERE c.user_id=$1 AND i.collection_id=$2 AND i.dataset=$3 AND i.source_word_id=$4 FOR UPDATE OF i`,
        [userId, delta.collectionId, delta.dataset, delta.sourceWordId]);
      const row = result.rows[0]; if (!row) continue;
      const item = { ...row, memory_card: databaseJsonObject<CardInput>(row.memory_card),
        review_seed: databaseJsonObject<CardInput>(row.review_seed), review_history: databaseJsonArray<ReviewEvent>(row.review_history) };
      const now = Date.now();
      const incoming = delta.reviews?.map(event => ({ ...event, reviewedAt: new Date(Math.min(now, Date.parse(event.reviewedAt))).toISOString() }));
      const { events, added } = mergeReviews(item.review_history, incoming || []);
      const seed = item.review_seed || initialMemory(item, now);
      const card = added.length ? replayReviews(seed, events) : item.memory_card;
      // Event IDs make review outcomes and memory updates safe to retry. Legacy clients
      // still upload totals; their unknown review sequence is never fabricated.
      const correct = incoming ? added.filter(event => event.rating !== "again").length : delta.correct;
      const wrong = incoming ? added.filter(event => event.rating === "again").length : delta.wrong;
      const lastReviewedAt = added.length ? new Date(Math.max(...added.map(event => Date.parse(event.reviewedAt)))) : incoming ? null : delta.lastReviewedAt;
      await client.query(`UPDATE vocabulary_collection_item SET appearance_count=appearance_count+$4,
        correct_count=correct_count+$5,wrong_count=wrong_count+$6,
        last_reviewed_at=CASE WHEN $5+$6>0 THEN GREATEST(last_reviewed_at,COALESCE($7::timestamptz,NOW())) ELSE last_reviewed_at END,
        memory_card=$8::jsonb,review_seed=$9::jsonb,review_history=$10::jsonb
        WHERE collection_id=$1 AND dataset=$2 AND source_word_id=$3`,
        [delta.collectionId, delta.dataset, delta.sourceWordId, delta.appearances, correct, wrong, lastReviewedAt,
          card ? JSON.stringify(card) : null, added.length || item.review_seed ? JSON.stringify(seed) : null, JSON.stringify(events)]);
    }
  });
}

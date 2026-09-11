import type { CardInput } from "ts-fsrs";
import { databaseJsonObject } from "./database-json";
import { initialMemory, scheduler, type MemoryItem } from "./collection-memory";
import { reviewPriority } from "./collection-order";
import type { VocabularyReviewSummary } from "@lib/client-api/types";

export function reviewSummary(row: Omit<MemoryItem, "memory_card"> & { memory_card: unknown }, now: number): VocabularyReviewSummary {
  const item = { ...row, memory_card: databaseJsonObject<CardInput>(row.memory_card) };
  const card = initialMemory(item, now);
  const priority = reviewPriority({ ...item, dataset: "", source_word_id: 0 }, now);
  return {
    addedAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    lastReviewedAt: row.last_reviewed_at ? new Date(row.last_reviewed_at).toISOString() : null,
    dueAt: priority.isNew ? null : new Date(card.due).toISOString(),
    status: priority.isNew ? "new" : priority.due ? "due" : "scheduled",
    estimated: !item.memory_card && !priority.isNew,
    recallProbability: priority.isNew || !card.last_review ? null : scheduler.get_retrievability(card, new Date(Math.max(now, new Date(card.last_review).getTime())), false),
    stabilityDays: priority.isNew ? null : card.stability,
    difficulty: priority.isNew ? null : card.difficulty,
    lapses: item.memory_card ? card.lapses : null,
    calculatedAt: new Date(now).toISOString(),
  };
}

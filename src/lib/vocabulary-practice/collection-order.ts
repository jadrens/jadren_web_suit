import { State } from "ts-fsrs";
import { initialMemory, MAX_REVIEW_INTERVAL_DAYS, scheduler, type MemoryItem } from "./collection-memory";

export const COLLECTION_ORDER_TTL_MS = 8 * 60 * 60 * 1000;
export interface ReviewItem extends MemoryItem { dataset: string; source_word_id: number }
export const reviewItemKey = (item: Pick<ReviewItem, "dataset" | "source_word_id">) => JSON.stringify([item.dataset, Number(item.source_word_id)]);
export function orderExpired(generatedAt: string | Date | null, now: number) {
  return !generatedAt || now - new Date(generatedAt).getTime() >= COLLECTION_ORDER_TTL_MS;
}

export function reviewPriority(item: ReviewItem, now: number) {
  const card = initialMemory(item, now);
  const ageDays = card.last_review ? Math.max(0, now - new Date(card.last_review).getTime()) / 86400000 : 0;
  const overdueDays = Math.max(0, now - new Date(card.due).getTime()) / 86400000;
  const recall = card.last_review ? scheduler.get_retrievability(card, new Date(Math.max(now, new Date(card.last_review).getTime())), false) : 0;
  return {
    isNew: card.state === State.New,
    due: new Date(card.due).getTime() <= now || ageDays >= MAX_REVIEW_INTERVAL_DAYS,
    // Overdue urgency grows without a cap, so old mastered words cannot disappear.
    score: overdueDays / Math.max(1, card.scheduled_days) + (1 - recall) + ageDays / MAX_REVIEW_INTERVAL_DAYS + card.difficulty / 100,
  };
}

export function collectionOrder(items: ReviewItem[], saved: string[], regenerate: boolean, now: number) {
  if (!regenerate) {
    const available = new Set(items.map(reviewItemKey));
    const existing = [...new Set(saved)].filter(key => available.has(key));
    const seen = new Set(existing);
    return [...existing, ...items.map(reviewItemKey).filter(key => !seen.has(key))];
  }
  const ranked = items.map(item => ({ key: reviewItemKey(item), ...reviewPriority(item, now) }));
  const compare = (a: typeof ranked[number], b: typeof ranked[number]) => b.score - a.score;
  const due = ranked.filter(item => !item.isNew && item.due).sort(compare);
  const fresh = ranked.filter(item => item.isNew);
  const future = ranked.filter(item => !item.isNew && !item.due).sort(compare);
  const result: string[] = []; let nextNew = 0;
  // Mix one unlearned word into every five slots while overdue reviews remain.
  for (let i = 0; i < due.length; i++) {
    result.push(due[i].key);
    if ((i + 1) % 4 === 0 && nextNew < fresh.length) result.push(fresh[nextNew++].key);
  }
  return [...result, ...fresh.slice(nextNew).map(item => item.key), ...future.map(item => item.key)];
}

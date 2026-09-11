import { createEmptyCard, fsrs, Rating, State, type CardInput } from "ts-fsrs";

export const MAX_REVIEW_INTERVAL_DAYS = 90;
export const scheduler = fsrs({ request_retention: 0.9, maximum_interval: MAX_REVIEW_INTERVAL_DAYS, enable_fuzz: false });
export interface ReviewEvent { id: string; reviewedAt: string; rating: "again" | "hard" | "good" }
export interface MemoryItem {
  correct_count: number;
  wrong_count: number;
  last_reviewed_at: string | Date | null;
  created_at?: string | Date;
  memory_card?: CardInput | null;
}

// Historical totals have no review intervals. Use a conservative prior (at most
// three days), rather than inventing a history of spaced successful reviews.
export function initialMemory(item: MemoryItem, now: number): CardInput {
  if (item.memory_card) return item.memory_card;
  const correct = Number(item.correct_count), wrong = Number(item.wrong_count);
  const reference = new Date(item.last_reviewed_at || item.created_at || now);
  const card = createEmptyCard(reference);
  if (!correct && !wrong) return card;
  const accuracy = (correct + 1) / (correct + wrong + 2);
  const stability = 0.25 + 2.75 * accuracy;
  return { ...card, stability, difficulty: 10 - 9 * accuracy, reps: correct + wrong, lapses: wrong,
    state: State.Review, last_review: reference, scheduled_days: stability,
    due: new Date(reference.getTime() + stability * 86400000) };
}

export function replayReviews(seed: CardInput, events: ReviewEvent[]): CardInput {
  let card = seed;
  const ratings = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good } as const;
  const ordered = [...new Map(events.map(event => [event.id, event])).values()]
    .sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt) || a.id.localeCompare(b.id));
  for (const event of ordered) {
    // Older offline events can precede the legacy prior, but must never move the clock backwards.
    const at = new Date(Math.max(Date.parse(event.reviewedAt), card.last_review ? new Date(card.last_review).getTime() : 0));
    const next = scheduler.next(card, at, ratings[event.rating]).card;
    // Enforce the product cap even when the scheduler's minimum-interval adjustment exceeds it.
    card = { ...next, scheduled_days: Math.min(MAX_REVIEW_INTERVAL_DAYS, next.scheduled_days),
      due: new Date(Math.min(next.due.getTime(), at.getTime() + MAX_REVIEW_INTERVAL_DAYS * 86400000)) };
  }
  return card;
}

export function mergeReviews(saved: ReviewEvent[], incoming: ReviewEvent[]) {
  const seen = new Set(saved.map(event => event.id));
  const added = incoming.filter(event => { if (seen.has(event.id)) return false; seen.add(event.id); return true; });
  return { events: [...saved, ...added], added };
}

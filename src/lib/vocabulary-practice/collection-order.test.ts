import { describe, expect, test } from "bun:test";
import { COLLECTION_ORDER_TTL_MS, collectionOrder, orderExpired, reviewItemKey, type ReviewItem } from "./collection-order";
import { initialMemory, mergeReviews, replayReviews, scheduler, type ReviewEvent } from "./collection-memory";
import { validReviewEvents } from "./collection-reviews";

const now = Date.parse("2026-09-11T12:00:00Z");
const day = 86400000;
const item = (id: number, days: number | null, correct = 0, wrong = 0): ReviewItem => ({ dataset: "ncee", source_word_id: id, correct_count: correct, wrong_count: wrong, created_at: new Date(now - 30 * day), last_reviewed_at: days === null ? null : new Date(now - days * day) });
const event = (id: number, days: number, rating: ReviewEvent["rating"]): ReviewEvent => ({ id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`, reviewedAt: new Date(now + days * day).toISOString(), rating });
const seed = initialMemory(item(1, null), now);

describe("collection review snapshots", () => {
  test("initial order and the exact eight-hour boundary require regeneration", () => {
    expect(orderExpired(null, now)).toBe(true);
    expect(orderExpired(new Date(now - COLLECTION_ORDER_TTL_MS + 1), now)).toBe(false);
    expect(orderExpired(new Date(now - COLLECTION_ORDER_TTL_MS), now)).toBe(true);
  });
  test("long-neglected mastered words return ahead of recent mistakes", () => {
    const old = item(1, 180, 100, 0), recent = item(2, 0, 0, 10);
    expect(collectionOrder([recent, old], [], true, now)[0]).toBe(reviewItemKey(old));
  });
  test("practice statistics do not change a valid snapshot; forced regeneration does", () => {
    const items = [item(1, 0, 1), item(2, 30, 1)];
    const saved = items.map(reviewItemKey);
    expect(collectionOrder(items, saved, false, now)).toEqual(saved);
    expect(collectionOrder(items, saved, true, now)).toEqual([...saved].reverse());
  });
  test("deletions retain relative order, additions append, and datasets distinguish duplicate IDs", () => {
    const a = item(1, null), b = item(2, null), c = { ...a, dataset: "custom" };
    expect(collectionOrder([a, b, c], [reviewItemKey(b), reviewItemKey(item(3, null)), reviewItemKey(a)], false, now)).toEqual([b, a, c].map(reviewItemKey));
  });
  test("new words interleave with overdue reviews without starving either group", () => {
    const due = Array.from({ length: 8 }, (_, i) => item(i, 30, 1));
    const fresh = [item(9, null), item(10, null)];
    const order = collectionOrder([...fresh, ...due], [], true, now);
    expect(order[4]).toBe(reviewItemKey(fresh[0]));
    expect(order[9]).toBe(reviewItemKey(fresh[1]));
    expect(new Set(order).size).toBe(10);
  });
  test("ties are deterministic", () => {
    const items = [item(2, null), item(1, null)];
    expect(collectionOrder(items, [], true, now)).toEqual(items.map(reviewItemKey));
    expect(collectionOrder(items, [], true, now)).toEqual(items.map(reviewItemKey));
  });
});

describe("FSRS memory updates", () => {
  test("spaced recall builds more stability than immediate repetition", () => {
    const spaced = replayReviews(seed, [event(1, 0, "good"), event(2, 5, "good"), event(3, 20, "good")]);
    const crammed = replayReviews(seed, [event(1, 0, "good"), event(2, 0.01, "good"), event(3, 0.02, "good")]);
    expect(spaced.stability).toBeGreaterThan(crammed.stability);
  });
  test("forgetting a learned word lowers stability and increases difficulty", () => {
    const history = [event(1, 0, "good"), event(2, 5, "good"), event(3, 20, "good")];
    const good = replayReviews(seed, [...history, event(4, 40, "good")]);
    const again = replayReviews(seed, [...history, event(4, 40, "again")]);
    expect(again.stability).toBeLessThan(good.stability);
    expect(again.difficulty).toBeGreaterThan(good.difficulty);
    expect(new Date(again.due).getTime()).toBeLessThan(new Date(good.due).getTime());
  });
  test("hint-assisted recall is weaker than unaided recall", () => {
    const history = [event(1, 0, "good"), event(2, 5, "good")];
    expect(replayReviews(seed, [...history, event(3, 20, "hard")]).stability).toBeLessThan(replayReviews(seed, [...history, event(3, 20, "good")]).stability);
  });
  test("recall probability falls with time even after many successes, with intervals capped at 90 days", () => {
    const card = replayReviews(seed, Array.from({ length: 10 }, (_, i) => event(i, i * 90, "good")));
    expect(card.scheduled_days).toBeLessThanOrEqual(90);
    const at = new Date(card.last_review!).getTime();
    expect(scheduler.get_retrievability(card, new Date(at + 180 * day), false)).toBeLessThan(scheduler.get_retrievability(card, new Date(at + day), false));
  });
  test("offline events replay chronologically, and repeated uploads do not add reviews", () => {
    const a = event(1, 0, "good"), b = event(2, 5, "again");
    const merged = mergeReviews([a], [b, a, b]);
    expect(merged.added).toEqual([b]);
    expect(replayReviews(seed, [b, a, a])).toEqual(replayReviews(seed, [a, b]));
  });
  test("legacy totals never imply a long history of spaced recall", () => {
    expect(initialMemory(item(1, 10, 10000), now).stability).toBeLessThanOrEqual(3);
  });
  test("rejects malformed or unbounded incoming review histories", () => {
    expect(validReviewEvents([event(1, 0, "good")])).toBe(true);
    expect(validReviewEvents([{ ...event(1, 0, "good"), rating: "easy" }])).toBe(false);
    expect(validReviewEvents([{ ...event(1, 0, "good"), reviewedAt: "invalid" }])).toBe(false);
    expect(validReviewEvents(Array(10001).fill(event(1, 0, "good")))).toBe(false);
  });
});

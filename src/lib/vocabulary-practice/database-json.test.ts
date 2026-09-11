import { expect, test } from "bun:test";
import type { CardInput } from "ts-fsrs";
import { databaseJsonArray, databaseJsonObject } from "./database-json";
import { collectionOrder, reviewItemKey, type ReviewItem } from "./collection-order";
import { initialMemory, mergeReviews, replayReviews, type ReviewEvent } from "./collection-memory";

const now = Date.parse("2026-09-11T12:00:00Z");
const item: ReviewItem = { dataset: "ncee", source_word_id: 1, correct_count: 0, wrong_count: 0, last_reviewed_at: null };

test("serialized snapshot preserves its order within the eight-hour window", () => {
  const items = [item, { ...item, source_word_id: 2 }];
  const saved = items.map(reviewItemKey).reverse();
  for (const raw of [saved, JSON.stringify(saved)]) {
    const parsed = databaseJsonArray<string>(raw);
    expect(new Map(parsed.map((key, index) => [key, index])).get(saved[0])).toBe(0);
    expect(collectionOrder(items, parsed, false, now)).toEqual(saved);
  }
});

test("serialized FSRS seed, memory and review history can be replayed without losing state", () => {
  const seed = initialMemory(item, now);
  const events: ReviewEvent[] = [{ id: "00000000-0000-4000-8000-000000000001", reviewedAt: new Date(now).toISOString(), rating: "good" }];
  const card = replayReviews(seed, events);
  for (const serialized of [false, true]) {
    const value = (input: unknown) => serialized ? JSON.stringify(input) : input;
    const parsedSeed = databaseJsonObject<CardInput>(value(seed))!;
    const parsedCard = databaseJsonObject<CardInput>(value(card))!;
    const parsedEvents = databaseJsonArray<ReviewEvent>(value(events));
    expect(replayReviews(parsedSeed, parsedEvents)).toEqual(card);
    expect(initialMemory({ ...item, memory_card: parsedCard }, now).stability).toBe(card.stability);
    expect(mergeReviews(parsedEvents, events).added).toEqual([]);
  }
});

test("null JSON fields normalize to their empty defaults", () => {
  for (const raw of [null, undefined, "null"]) {
    expect(databaseJsonArray(raw)).toEqual([]);
    expect(databaseJsonObject(raw)).toBeNull();
  }
});

test("malformed data fails explicitly instead of silently replacing saved state", () => {
  expect(() => databaseJsonArray("invalid")).toThrow();
  expect(() => databaseJsonArray('{}')).toThrow();
  expect(() => databaseJsonObject('[]')).toThrow();
});

import { expect, test } from "bun:test";
import { reviewSummary } from "./review-summary";
import { initialMemory, replayReviews } from "./collection-memory";

const now = Date.parse("2026-09-11T12:00:00Z");
const item = { correct_count: 0, wrong_count: 0, last_reviewed_at: null, created_at: new Date(now - 86400000), memory_card: null };

test("unreviewed words do not display invented review times or memory estimates", () => {
  expect(reviewSummary(item, now)).toMatchObject({ status: "new", lastReviewedAt: null, dueAt: null, recallProbability: null, stabilityDays: null, difficulty: null, lapses: null, estimated: false });
});

test("legacy estimates are labeled and do not claim an observed last-review time", () => {
  expect(reviewSummary({ ...item, correct_count: 10 }, now)).toMatchObject({ estimated: true, lastReviewedAt: null, lapses: null });
});

test("serialized FSRS state exposes finite estimates and observed review timestamps", () => {
  const at = new Date(now).toISOString();
  const card = replayReviews(initialMemory(item, now), [{ id: "1", reviewedAt: at, rating: "good" }]);
  const summary = reviewSummary({ ...item, correct_count: 1, last_reviewed_at: at, memory_card: JSON.stringify(card) }, now);
  expect(summary).toMatchObject({ estimated: false, lastReviewedAt: at, stabilityDays: card.stability, difficulty: card.difficulty, lapses: card.lapses, status: "scheduled" });
  expect(summary.recallProbability).toBeGreaterThanOrEqual(0);
  expect(summary.recallProbability).toBeLessThanOrEqual(1);
  expect(reviewSummary({ ...item, memory_card: card }, now + 180 * 86400000).status).toBe("due");
});

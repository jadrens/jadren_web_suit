import type { ReviewEvent } from "./collection-memory";

export function validReviewEvents(value: unknown): value is ReviewEvent[] | undefined {
  return value === undefined || (Array.isArray(value) && value.length <= 10000 && value.every(event =>
    event && typeof event === "object" && typeof event.id === "string" && /^[0-9a-f-]{36}$/i.test(event.id) &&
    ["again", "hard", "good"].includes(event.rating) && typeof event.reviewedAt === "string" && Number.isFinite(Date.parse(event.reviewedAt))));
}

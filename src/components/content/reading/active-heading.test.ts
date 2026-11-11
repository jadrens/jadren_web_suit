import { describe, expect, test } from "bun:test";
import { findActiveHeading } from "./active-heading";

describe("article scroll tracking", () => {
  const headings = [100, 300, 600].map((top, index) => ({
    getBoundingClientRect: () => ({ top }),
    getAttribute: () => `heading-${index}`,
  }));

  test("tracks the last heading above the trigger, including exact boundaries", () => {
    expect(findActiveHeading([], 300)).toBeNull();
    expect(findActiveHeading(headings, 99)).toBeNull();
    expect(findActiveHeading(headings, 100)).toBe("heading-0");
    expect(findActiveHeading(headings, 500)).toBe("heading-1");
    expect(findActiveHeading(headings, 600)).toBe("heading-2");
    expect(findActiveHeading(headings, 1000)).toBe("heading-2");
  });

  test("long articles do not require a layout read for every heading on scroll", () => {
    let reads = 0;
    const longArticle = Array.from({ length: 1024 }, (_, index) => ({
      getBoundingClientRect: () => { reads++; return { top: index * 100 }; },
      getAttribute: () => `heading-${index}`,
    }));
    expect(findActiveHeading(longArticle, 51_250)).toBe("heading-512");
    expect(reads).toBeLessThanOrEqual(11);
  });
});

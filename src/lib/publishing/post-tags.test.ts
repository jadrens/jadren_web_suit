import { describe, expect, test } from "bun:test";
import { indexPostsByTag } from "./post-tags";

describe("blog tag index", () => {
  test("indexes author-supplied tag names that collide with object properties", () => {
    const post = { slug: "example", tags: ["__proto__", "constructor", "toString"] };
    const index = indexPostsByTag([post]);
    expect(Object.keys(index)).toEqual(post.tags);
    for (const tag of post.tags) expect(index[tag]).toEqual([post]);
    expect(index.hasOwnProperty).toBeUndefined();
  });

  test("preserves post order in every tag and handles posts without tags", () => {
    const first = { slug: "new", tags: ["network", "linux"] };
    const second = { slug: "older", tags: ["network"] };
    const index = indexPostsByTag([first, second, { slug: "untagged", tags: [] }]);
    expect(index.network).toEqual([first, second]);
    expect(index.linux).toEqual([first]);
    expect(index.missing).toBeUndefined();
  });
});

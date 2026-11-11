import { describe, expect, test } from "bun:test";
import { replaceTags } from "./replace-tags";

function captureQueries() {
  const queries: { text: string; values: unknown[] }[] = [];
  return {
    queries,
    client: { query: async <T>(text: string, values: unknown[] = []) => {
      queries.push({ text, values });
      return { rows: [] as T[] };
    } },
  };
}

describe("article tag replacement", () => {
  test("replaces twenty tags in two database round trips, with all values bound", async () => {
    const { client, queries } = captureQueries();
    const tags = Array.from({ length: 20 }, (_, index) => index === 0 ? "SQL ' ; --" : `tag-${index}`);
    await replaceTags(client, "blog_post_pending_tag", "draft-id", tags);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toEqual({ text: "DELETE FROM blog_post_pending_tag WHERE pending_id = $1", values: ["draft-id"] });
    expect(queries[1].text).not.toContain(tags[0]);
    expect(queries[1].text).toContain("($1, $21)");
    expect(queries[1].values).toEqual(["draft-id", ...tags]);
  });

  test("removing every tag only deletes existing published tags", async () => {
    const { client, queries } = captureQueries();
    await replaceTags(client, "blog_post_tag", "post-id", []);
    expect(queries).toEqual([{ text: "DELETE FROM blog_post_tag WHERE post_id = $1", values: ["post-id"] }]);
  });
});

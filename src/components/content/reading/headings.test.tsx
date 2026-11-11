import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import MarkdownContent from "../MarkdownContent";
import { ReadingProgressProvider } from "./ReadingProgressContext";
import { extractHeadings, parseHeadings, type Heading } from "./headings";

const flatten = (headings: Heading[]): Heading[] => headings.flatMap((heading) => [heading, ...flatten(heading.children)]);

describe("article heading anchors", () => {
  test("uses visible Markdown text and supports setext and nested headings", () => {
    const content = "# **Hello** and `world`\n\n## [Reference][site] &amp; ~~old~~\n\nSetext heading\n---\n\n> ### Quoted heading\n\n[site]: https://example.com";
    expect(flatten(extractHeadings(content)).map(({ id, text }) => ({ id, text }))).toEqual([
      { id: "hello-and-world", text: "Hello and world" },
      { id: "reference-&-old", text: "Reference & old" },
      { id: "setext-heading", text: "Setext heading" },
      { id: "quoted-heading", text: "Quoted heading" },
    ]);
  });

  test("does not turn fenced or indented code into headings", () => {
    const content = "# Real\n\n````md\n## In code\n```\n### Still in code\n````\n\n~~~\n# Not a heading\n~~~\n\n    ## Indented code\n\n## Visible";
    expect(flatten(extractHeadings(content)).map(({ text }) => text)).toEqual(["Real", "Visible"]);
  });

  test("deduplicates anchors across all heading levels and existing suffixes", () => {
    const parsed = parseHeadings("## Repeat\n\n#### Repeat\n\n## Repeat\n\n## Repeat-1\n\n## ");
    expect([...parsed.idsByLine.values()]).toEqual(["repeat", "repeat-1", "repeat-2", "repeat-1-1", "section"]);
    expect(flatten(parsed.headings).map(({ id }) => id)).toEqual(["repeat", "repeat-2", "repeat-1-1", "section"]);
  });

  test("rendered anchors and outline links agree for formatted and repeated headings", () => {
    const content = "## **Hello** and `world`\n\n## Repeat\n\n## Repeat\n\n[Title](https://example.com)\n---\n\n### 标题 #fragment?";
    const headings = flatten(extractHeadings(content));
    const html = renderToStaticMarkup(<ReadingProgressProvider><MarkdownContent content={content} /></ReadingProgressProvider>);
    const renderedIds = [...html.matchAll(/data-heading-id="([^"]+)"/g)].map((match) => match[1]);
    expect(renderedIds).toEqual(headings.map(({ id }) => id));
    expect(new Set(renderedIds).size).toBe(renderedIds.length);
    expect(html).not.toContain("[object-object]");
    for (const heading of headings) expect(html).toContain(`href="#${encodeURIComponent(heading.id)}"`);
    expect(html).toContain('href="https://example.com"');
  });
});

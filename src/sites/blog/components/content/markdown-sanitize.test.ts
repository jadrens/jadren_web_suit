import { describe, expect, test } from "bun:test";
import { sanitize } from "hast-util-sanitize";
import type { Root } from "hast";
import { blogMarkdownSchema } from "./markdown-sanitize";

describe("blog Markdown HTML sanitizing", () => {
  test("keeps ordinary HTML and removes active content", () => {
    const tree: Root = {
      type: "root",
      children: [
        { type: "element", tagName: "details", properties: {}, children: [] },
        { type: "element", tagName: "script", properties: {}, children: [] },
        { type: "element", tagName: "iframe", properties: { srcDoc: "<script>alert(1)</script>" }, children: [] },
        { type: "element", tagName: "object", properties: { data: "https://attacker.example" }, children: [] },
      ],
    };

    const result = sanitize(tree, blogMarkdownSchema) as Root;

    expect(result.children).toEqual([
      { type: "element", tagName: "details", properties: {}, children: [] },
    ]);
  });

  test("removes event handlers and dangerous URL protocols", () => {
    const tree: Root = {
      type: "root",
      children: [{
        type: "element",
        tagName: "a",
        properties: { href: "javascript:alert(1)", onClick: "alert(1)", title: "safe" },
        children: [{ type: "text", value: "link" }],
      }],
    };

    const result = sanitize(tree, blogMarkdownSchema) as Root;
    const link = result.children[0];

    expect(link).toMatchObject({
      type: "element",
      tagName: "a",
      properties: { title: "safe" },
    });
  });
});

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { toString } from "mdast-util-to-string";

export interface Heading {
  id: string;
  text: string;
  level: 1 | 2 | 3;
  children: Heading[];
}

interface MarkdownNode {
  type: string;
  depth?: number;
  children?: MarkdownNode[];
  position?: { start: { line: number } };
}

// Match the renderer's Markdown syntax, including setext headings, inline
// formatting and fenced code. A second regular-expression parser drifts from it.
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

export function slugify(text: string): string {
  return text.trim().toLowerCase().replace(".", "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

export function parseHeadings(content: string) {
  const headings: Heading[] = [];
  const idsByLine = new Map<number, string>();
  const usedIds = new Set<string>();
  const parents: { level: number; children: Heading[] }[] = [{ level: 0, children: headings }];

  function visit(node: MarkdownNode) {
    if (node.type === "heading" && node.depth) {
      const text = toString(node, { includeHtml: false }).trim();
      const base = slugify(text) || "section";
      let id = base;
      let suffix = 0;
      while (usedIds.has(id)) id = `${base}-${++suffix}`;
      usedIds.add(id);
      if (node.position) idsByLine.set(node.position.start.line, id);
      // Lower-level headings still reserve their IDs so every anchor is unique.
      if (node.depth <= 3) {
        const heading: Heading = { id, text, level: node.depth as Heading["level"], children: [] };
        while (parents.length > 1 && parents[parents.length - 1].level >= node.depth) parents.pop();
        parents[parents.length - 1].children.push(heading);
        parents.push(heading);
      }
    }
    for (const child of node.children ?? []) visit(child);
  }

  visit(parser.parse(content));
  return { headings, idsByLine };
}

export function extractHeadings(content: string): Heading[] {
  return parseHeadings(content).headings;
}

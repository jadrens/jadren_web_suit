import { defaultSchema, type Options } from "rehype-sanitize";

// Raw HTML is useful in articles, but active/embedded content must never reach React.
// Start from GitHub's conservative HTML schema and explicitly remove elements that
// can execute code, embed another browsing context, submit data, or alter the page.
const blockedTags = new Set([
  "applet",
  "base",
  "button",
  "embed",
  "form",
  "frame",
  "frameset",
  "iframe",
  "input",
  "link",
  "meta",
  "object",
  "option",
  "script",
  "select",
  "style",
  "textarea",
]);

export const blogMarkdownSchema: Options = {
  ...defaultSchema,
  tagNames: defaultSchema.tagNames?.filter((tagName) => !blockedTags.has(tagName)),
};

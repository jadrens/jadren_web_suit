import { describe, expect, test } from "bun:test";
import { grammarMarkupToCorrectedText, parseGrammarMarkup, validateGrammarMarkup } from "./grammar-markup";

describe("grammar markup", () => {
  test("allows parentheses inside a correction", () => {
    const value = "How to improve the user loading \\delete{experience(eg.}\\correction{experience (e.g.,}\\{1} integrate multiple requests into one) when using \\delete{next.js.}\\correction{Next.js.}\\{2}";

    expect(validateGrammarMarkup(value)).toEqual([
      { reference: 1, original: "experience(eg.", replacement: "experience (e.g.," },
      { reference: 2, original: "next.js.", replacement: "Next.js." },
    ]);
    expect(parseGrammarMarkup(value).filter((part) => part.type === "correction")).toHaveLength(2);
    expect(grammarMarkupToCorrectedText(value)).toBe("How to improve the user loading experience (e.g., integrate multiple requests into one) when using Next.js.");
  });
});

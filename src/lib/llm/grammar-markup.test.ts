import { describe, expect, test } from "bun:test";
import { grammarMarkupToCorrectedText, parseGrammarMarkup, validateGrammarMarkup } from "./grammar-markup";

describe("grammar markup", () => {
  test("allows parentheses inside a correction", () => {
    const value = "How to improve the user loading <del>experience(eg.</del><ins>experience (e.g.,</ins><sup>1</sup> integrate multiple requests into one) when using <del>next.js.</del><ins>Next.js.</ins><sup>2</sup>";

    expect(validateGrammarMarkup(value)).toEqual([
      { reference: 1, original: "experience(eg.", replacement: "experience (e.g.," },
      { reference: 2, original: "next.js.", replacement: "Next.js." },
    ]);
    expect(parseGrammarMarkup(value).filter((part) => part.type === "correction")).toHaveLength(2);
    expect(grammarMarkupToCorrectedText(value)).toBe("How to improve the user loading experience (e.g., integrate multiple requests into one) when using Next.js.");
  });

  test("supports insertions, deletions, multiline text and JSON transport", () => {
    const value = "I<del></del><ins> really</ins><sup>1</sup> like <del>this\n</del><ins></ins><sup>2</sup>{book}.";
    expect(validateGrammarMarkup(JSON.parse(JSON.stringify({ marked_text: value })).marked_text)).toHaveLength(2);
    expect(grammarMarkupToCorrectedText(value)).toBe("I really like {book}.");
  });

  test("decodes escaped text once without treating it as markup", () => {
    const value = "&lt;ins&gt; &amp;lt; <del>&lt;old&gt;</del><ins>&lt;script&gt; &amp; &quot;new&quot; &#39;text&#39;</ins><sup>1</sup>";
    expect(validateGrammarMarkup(value)[0].original).toBe("<old>");
    expect(grammarMarkupToCorrectedText(value)).toBe('<ins> &lt; <script> & "new" \'text\'');
  });

  test("rejects invalid numbering and malformed or extra tags", () => {
    for (const value of [
      "<del>a</del><ins>b</ins><sup>2</sup>",
      "<del>a</del><ins>b</ins><sup>1</sup><del>c</del><ins>d</ins><sup>1</sup>",
      "<del>a</del><ins>b</ins><sup>1</sup><del>broken",
      '<del onclick="alert(1)">a</del><ins>b</ins><sup>1</sup>',
      "<del><b>a</b></del><ins>b</ins><sup>1</sup>",
      "<del>a</del><ins>b</ins><sup>1</sup><script>alert(1)</script>",
    ]) expect(() => validateGrammarMarkup(value)).toThrow();
  });

  test("reads legacy history but rejects legacy syntax in new results", () => {
    const value = "I \\delete{has}\\correction{have}\\{1} a book &amp;.";
    expect(grammarMarkupToCorrectedText(value)).toBe("I have a book &amp;.");
    expect(parseGrammarMarkup(value)[1]).toEqual({ type: "correction", reference: 1, original: "has", replacement: "have" });
    expect(() => validateGrammarMarkup(value)).toThrow();
  });
});

import { describe, expect, test } from "bun:test";
import type { VirtualKeyboardKeycap, VirtualKeyboardLayout } from "mathlive";
import { ALPHABETIC_LAYOUT, KEYBOARD_LAYOUTS, MATH_LAYOUT, STRUCTURE_ROW } from "./keyboard";
import { buildOutput, exportLatex } from "./latex-utils";

type KeycapInput = string | Partial<VirtualKeyboardKeycap>;

function keyWidth(keycap: KeycapInput): number {
  if (typeof keycap === "string") {
    if (keycap === "[separator-5]") return 0.5;
    if (keycap === "[shift]" || keycap === "[backspace]" || keycap === "[action]" || keycap === "[return]") {
      return 1.5;
    }
    return 1;
  }
  if (keycap.width !== undefined) return keycap.width;
  if (keycap.label === "[separator-5]") return 0.5;
  if (
    keycap.label === "[shift]" ||
    keycap.label === "[backspace]" ||
    keycap.label === "[action]" ||
    keycap.label === "[return]"
  ) {
    return 1.5;
  }
  return 1;
}

function layoutRows(layout: VirtualKeyboardLayout): KeycapInput[][] {
  if (!("rows" in layout)) {
    throw new Error("Expected single-layer keyboard layout with rows");
  }
  return layout.rows;
}

describe("LaTeX virtual keyboard layouts", () => {
  test("sets the compact math layout as the first default tab without the upstream numeric layout", () => {
    expect(KEYBOARD_LAYOUTS[0]).toBe(MATH_LAYOUT);
    expect(MATH_LAYOUT.label).toBe("f(x)");
    expect(KEYBOARD_LAYOUTS).toContain(ALPHABETIC_LAYOUT);
    expect(KEYBOARD_LAYOUTS).not.toContain("numeric");
  });

  test("aligns every row in the math and alphabetic layouts to 10 keycap units", () => {
    for (const layout of [MATH_LAYOUT, ALPHABETIC_LAYOUT]) {
      for (const row of layoutRows(layout)) {
        const total = row.reduce((sum, keycap) => sum + keyWidth(keycap), 0);
        expect(total).toBe(10);
      }
    }
  });

  test("puts all frequent variables, f(...), o/p/q, and alpha/beta/gamma directly on the primary math layer", () => {
    const keyValues = layoutRows(MATH_LAYOUT)
      .flat()
      .map((keycap) => (typeof keycap === "string" ? keycap : keycap.latex ?? keycap.label ?? ""))
      .filter(Boolean);

    for (const expected of ["a", "b", "c", "d", "e", "f", "f(#0)", "x", "y", "z", "o", "p", "q", "\\alpha", "\\beta", "\\gamma"]) {
      expect(keyValues).toContain(expected);
    }
  });

  test("uses MathLive script commands and safe variant inserts for subscript and superscript keys", () => {
    const [subscript, superscript] = STRUCTURE_ROW;
    expect(subscript.command).toEqual(["performWithFeedback", "moveToSubscript"]);
    expect(superscript.command).toEqual(["performWithFeedback", "moveToSuperscript"]);

    for (const keycap of [subscript, superscript]) {
      expect(Array.isArray(keycap.variants)).toBe(true);
      for (const variant of keycap.variants as (string | Partial<VirtualKeyboardKeycap>)[]) {
        expect(typeof variant).toBe("object");
        const insert = (variant as Partial<VirtualKeyboardKeycap>).insert ?? "";
        expect(insert.startsWith("#@_")).toBe(false);
        expect(insert.startsWith("#@^")).toBe(false);
      }
    }
  });
});

describe("LaTeX export helpers", () => {
  test("strips placeholders without introducing double braces", () => {
    expect(exportLatex("\\frac{\\placeholder{}}{2}")).toBe("\\frac{}{2}");
    expect(exportLatex("x_{\\placeholder{}}")).toBe("x_{}");
    expect(exportLatex("f(\\placeholder{})")).toBe("f()");
    expect(exportLatex("\\placeholder[id]{x}")).toBe("x");
    expect(exportLatex("  \\int_0^1 x\\,\\mathrm{d}x  ")).toBe("\\int_0^1 x\\,\\mathrm{d}x");
  });

  test("formats display, align, and plain outputs", () => {
    const lines = [{ latex: "a=1" }, { latex: " \\placeholder{} " }, { latex: "b=2" }];
    expect(buildOutput(lines, "plain")).toBe("a=1\nb=2");
    expect(buildOutput(lines, "display")).toBe("$$\na=1\n$$\n\n$$\nb=2\n$$");
    expect(buildOutput(lines, "align")).toBe("\\begin{align*}\n  a=1 \\\\\n  b=2\n\\end{align*}");
    expect(buildOutput([{ latex: "\\placeholder{}" }], "display")).toBe("");
  });
});

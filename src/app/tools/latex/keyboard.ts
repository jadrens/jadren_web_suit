import type { VirtualKeyboardKeycap, VirtualKeyboardLayout, VirtualKeyboardName } from "mathlive";

type Keycap = Partial<VirtualKeyboardKeycap>;

// Templates use MathLive placeholders: #@ wraps the current selection, #? is an empty slot, #0 takes the selection or a slot.
const STRUCTURE_ROW: Keycap[] = [
  // Long-pressing the subscript key offers the subscripts that are typed most often, so they need no cursor escape afterwards.
  {
    latex: "#@_{#?}",
    class: "hide-shift",
    variants: ["#@_{0}", "#@_{1}", "#@_{2}", "#@_{i}", "#@_{j}", "#@_{n}", "#@_{x}", "#@_{ab}", "#@_{\\max}", "#@_{\\min}"],
  },
  {
    latex: "#@^{#?}",
    class: "hide-shift",
    variants: ["#@^2", "#@^3", "#@^{-1}", "#@^{n}", "#@^{\\prime}", "#@^{\\circ}", "#@^{\\mathsf{T}}"],
  },
  { latex: "\\frac{#@}{#?}", class: "hide-shift", variants: ["\\dfrac{#@}{#?}", "\\frac{1}{#?}", "\\frac{1}{2}"] },
  { latex: "\\sqrt{#0}", class: "hide-shift", variants: ["\\sqrt[#?]{#0}", "\\sqrt[3]{#0}"] },
  { latex: "\\left(#0\\right)", class: "hide-shift", variants: ["\\left[#0\\right]", "\\left\\{#0\\right\\}", "\\left|#0\\right|", "\\left\\|#0\\right\\|", "\\langle #0\\rangle"] },
  { latex: "\\sum_{#?}^{#?}", class: "hide-shift", variants: ["\\sum", "\\prod_{#?}^{#?}", "\\lim_{#?\\to#?}"] },
  { latex: "\\int_{#?}^{#?}#0\\,\\mathrm{d}#?", class: "small hide-shift", variants: ["\\int", "\\iint", "\\oint"] },
  { latex: "\\partial", class: "hide-shift", variants: ["\\nabla", "\\frac{\\partial #?}{\\partial #?}", "\\frac{\\mathrm{d}#?}{\\mathrm{d}#?}"] },
  { latex: "\\infty", class: "hide-shift", variants: ["\\to", "\\Rightarrow", "\\Leftrightarrow", "\\approx", "\\propto"] },
  { latex: "\\cdot", class: "hide-shift", variants: ["\\times", "\\div", "\\pm", "\\mp", "\\circ"] },
];

// Greek letters sit behind a long press of the Latin letter they sound like, so Greek never needs a layout switch.
const GREEK: Record<string, string[]> = {
  a: ["\\alpha"],
  b: ["\\beta"],
  c: ["\\chi"],
  d: ["\\delta", "\\Delta"],
  e: ["\\epsilon", "\\varepsilon", "\\eta"],
  f: ["\\phi", "\\varphi", "\\Phi"],
  g: ["\\gamma", "\\Gamma"],
  h: ["\\eta"],
  k: ["\\kappa"],
  l: ["\\lambda", "\\Lambda"],
  m: ["\\mu"],
  n: ["\\nu"],
  o: ["\\omega", "\\Omega"],
  p: ["\\pi", "\\psi", "\\Pi", "\\Psi"],
  q: ["\\theta"],
  r: ["\\rho"],
  s: ["\\sigma", "\\Sigma"],
  t: ["\\theta", "\\tau", "\\Theta"],
  w: ["\\omega"],
  x: ["\\xi", "\\chi"],
  y: ["\\psi", "\\upsilon"],
  z: ["\\zeta"],
};

const DIGIT_SHIFT: Record<string, Keycap> = {
  "5": { latex: "\\frac{#@}{#?}" },
  "6": { latex: "#@^#?" },
  "8": { latex: "\\times" },
  "9": { label: "(", latex: "(" },
  "0": { label: ")", latex: ")" },
};

function letterKey(letter: string): Keycap {
  const variants = [letter, ...(GREEK[letter] ?? [])];
  return {
    label: letter,
    class: "hide-shift",
    shift: { label: letter.toUpperCase() },
    variants: variants.length > 1 ? variants : undefined,
  };
}

const DIGITS = "1234567890".split("").map((digit): Keycap => ({ label: digit, variants: digit, shift: DIGIT_SHIFT[digit] }));

// The stock "abc" layer plus one row of structures on top; the stock layout has no subscript key at all.
const MAIN_LAYOUT: VirtualKeyboardLayout = {
  label: "abc",
  labelClass: "MLK__tex-math",
  tooltip: "keyboard.tooltip.alphabetic",
  rows: [
    STRUCTURE_ROW,
    DIGITS,
    "qwertyuiop".split("").map(letterKey),
    ["[separator-5]", ..."asdfghjkl".split("").map(letterKey), "[separator-5]"],
    ["[shift]", ..."zxcvbnm".split("").map(letterKey), "[backspace]"],
    ["[-]", "[+]", "[=]", { label: " ", width: 1.5 }, "[(]", "[)]", "[left]", "[right]", { label: "[action]", width: 1.5 }],
  ],
};

export const KEYBOARD_LAYOUTS: (VirtualKeyboardName | VirtualKeyboardLayout)[] = [MAIN_LAYOUT, "numeric", "symbols", "greek"];

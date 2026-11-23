import type { VirtualKeyboardKeycap, VirtualKeyboardLayout, VirtualKeyboardName } from "mathlive";

type Keycap = Partial<VirtualKeyboardKeycap>;

// Templates use MathLive placeholders: #@ wraps the current selection, #? is an empty slot, #0 takes the selection or a slot.
export const STRUCTURE_ROW: Keycap[] = [
  // Use MathLive's native subscript/superscript commands so scripts attach directly to \int, \sum, and \prod without inserting a dummy base placeholder.
  {
    latex: "#@_{#?}",
    command: ["performWithFeedback", "moveToSubscript"],
    class: "hide-shift",
    variants: [
      { latex: "#@_{0}", insert: "_{0}" },
      { latex: "#@_{1}", insert: "_{1}" },
      { latex: "#@_{2}", insert: "_{2}" },
      { latex: "#@_{i}", insert: "_{i}" },
      { latex: "#@_{j}", insert: "_{j}" },
      { latex: "#@_{k}", insert: "_{k}" },
      { latex: "#@_{n}", insert: "_{n}" },
      { latex: "#@_{x}", insert: "_{x}" },
      { latex: "#@_{\\max}", insert: "_{\\max}" },
      { latex: "#@_{\\min}", insert: "_{\\min}" },
    ],
  },
  {
    latex: "#@^{#?}",
    command: ["performWithFeedback", "moveToSuperscript"],
    class: "hide-shift",
    variants: [
      { latex: "#@^2", insert: "^{2}" },
      { latex: "#@^3", insert: "^{3}" },
      { latex: "#@^{-1}", insert: "^{-1}" },
      { latex: "#@^n", insert: "^{n}" },
      { latex: "#@^{\\prime}", insert: "^{\\prime}" },
      { latex: "#@^{\\circ}", insert: "^{\\circ}" },
      { latex: "#@^{\\mathsf{T}}", insert: "^{\\mathsf{T}}" },
    ],
  },
  { latex: "\\frac{#@}{#?}", class: "small hide-shift", variants: ["\\dfrac{#@}{#?}", "\\frac{1}{#?}", "\\frac{1}{2}"] },
  { latex: "\\sqrt{#0}", class: "hide-shift", variants: ["\\sqrt[#?]{#0}", "\\sqrt[3]{#0}"] },
  {
    latex: "\\left(#0\\right)",
    class: "hide-shift",
    variants: ["\\left[#0\\right]", "\\left\\{#0\\right\\}", "\\left|#0\\right|", "\\left\\|#0\\right\\|", "\\langle #0\\rangle"],
  },
  {
    latex: "#@^2",
    insert: "^{2}",
    class: "hide-shift",
    variants: [
      { latex: "#@^3", insert: "^{3}" },
      { latex: "#@^{-1}", insert: "^{-1}" },
      { latex: "#@^n", insert: "^{n}" },
      { latex: "#@^{\\prime}", insert: "^{\\prime}" },
      { latex: "#@^{\\mathsf{T}}", insert: "^{\\mathsf{T}}" },
    ],
  },
  {
    latex: "\\int",
    insert: "\\int_{#?}^{#?}",
    class: "hide-shift",
    variants: [
      "\\int",
      { latex: "\\int\\mathrm{d}x", insert: "\\int_{#?}^{#?}#0\\,\\mathrm{d}#?", class: "small" },
      "\\iint",
      "\\oint",
      { latex: "\\sum", insert: "\\sum_{#?}^{#?}" },
      { latex: "\\prod", insert: "\\prod_{#?}^{#?}" },
      { latex: "\\lim", insert: "\\lim_{#?\\to#?}" },
      { latex: "\\mathrm{d}x", insert: "\\,\\mathrm{d}x" },
      { latex: "\\mathrm{d}t", insert: "\\,\\mathrm{d}t" },
    ],
  },
  {
    latex: "\\partial",
    class: "hide-shift",
    variants: [
      "\\nabla",
      { latex: "\\frac{\\mathrm{d}}{\\mathrm{d}x}", insert: "\\frac{\\mathrm{d}#?}{\\mathrm{d}#?}", class: "small" },
      { latex: "\\frac{\\partial}{\\partial x}", insert: "\\frac{\\partial #?}{\\partial #?}", class: "small" },
      "\\mathrm{d}",
    ],
  },
  {
    latex: "\\infty",
    class: "hide-shift",
    variants: ["\\to", "\\Rightarrow", "\\Leftrightarrow", "\\le", "\\ge", "\\ne", "\\approx", "\\equiv", "\\in"],
  },
  {
    latex: "\\cdot",
    class: "hide-shift",
    variants: ["\\times", "\\div", "\\pm", "\\mp", "\\circ", "\\pi"],
  },
];

// Greek letters sit behind a long press of the Latin letter they sound like on the QWERTY tab.
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

const MATH_VARIANTS: Record<string, (string | Keycap)[]> = {
  a: ["a", "A", "\\alpha", "a_n", "a_i", "\\forall"],
  b: ["b", "B", "\\beta", "b_n"],
  c: ["c", "C", "\\mathbb{C}", "\\chi", "\\subset", "\\subseteq"],
  d: ["d", "D", "\\mathrm{d}", "\\delta", "\\Delta", "\\partial"],
  e: ["e", "E", "e^{#?}", "\\epsilon", "\\varepsilon", "\\eta", "\\exists"],
  f: ["f", "F", "\\phi", "\\varphi", "\\Phi", { latex: "f(#0)", insert: "f(#0)", class: "small" }],
  o: ["o", "O", "\\omega", "\\Omega", { latex: "O(#0)", insert: "O(#0)", class: "small" }, "\\circ"],
  p: ["p", "P", "\\pi", "\\psi", "\\Pi", { latex: "P(#0)", insert: "P(#0)", class: "small" }, "\\mathbb{P}"],
  q: ["q", "Q", "\\theta", "\\Theta", "\\mathbb{Q}"],
  x: ["x", "X", "\\xi", "x^{2}", "x_{i}", "x_{n}"],
  y: ["y", "Y", "\\psi", "\\upsilon", "y^{2}", "y_{i}"],
  z: ["z", "Z", "\\mathbb{Z}", "\\zeta", "\\overline{z}"],
};

const DIGIT_SHIFT: Record<string, Keycap> = {
  "5": { latex: "\\frac{#@}{#?}" },
  "6": { latex: "#@^{#?}", command: ["performWithFeedback", "moveToSuperscript"] },
  "8": { latex: "\\times" },
  "9": { label: "(", latex: "(" },
  "0": { label: ")", latex: ")" },
};

function mathLetterKey(letter: string): Keycap {
  return {
    latex: letter,
    class: "hide-shift",
    shift: letter.toUpperCase(),
    variants: MATH_VARIANTS[letter],
  };
}

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

const FUNCTION_KEY: Keycap = {
  latex: "f(#0)",
  class: "small hide-shift",
  shift: { latex: "g(#0)", class: "small" },
  variants: [
    { latex: "f(x)", insert: "f(x)", class: "small" },
    { latex: "g(#0)", insert: "g(#0)", class: "small" },
    { latex: "h(#0)", insert: "h(#0)", class: "small" },
    { latex: "f'(#0)", insert: "f'(#0)", class: "small" },
    { latex: "f^{-1}(#0)", insert: "f^{-1}(#0)", class: "small" },
    { latex: "f(#?,#?)", insert: "f(#?,#?)", class: "small" },
    { latex: "\\sin(#0)", insert: "\\sin(#0)", class: "small" },
    { latex: "\\cos(#0)", insert: "\\cos(#0)", class: "small" },
    { latex: "\\ln(#0)", insert: "\\ln(#0)", class: "small" },
    { latex: "\\exp(#0)", insert: "\\exp(#0)", class: "small" },
  ],
};

// Default compact math layout: common variables, f(...), o/p/q, and alpha/beta/gamma on one screen without QWERTY clutter.
export const MATH_LAYOUT: VirtualKeyboardLayout = {
  label: "f(x)",
  labelClass: "MLK__tex-math",
  tooltip: "Math",
  rows: [
    STRUCTURE_ROW,
    DIGITS,
    [
      ..."abcdef".split("").map(mathLetterKey),
      FUNCTION_KEY,
      ..."xyz".split("").map(mathLetterKey),
    ],
    [
      { label: "[shift]", width: 2 },
      ..."opq".split("").map(mathLetterKey),
      {
        latex: "\\alpha",
        class: "hide-shift",
        shift: "\\Delta",
        variants: ["\\alpha", "\\delta", "\\Delta", "\\epsilon", "\\varepsilon", "\\eta"],
      },
      {
        latex: "\\beta",
        class: "hide-shift",
        shift: "\\Sigma",
        variants: ["\\beta", "\\theta", "\\Theta", "\\lambda", "\\Lambda", "\\mu", "\\nu", "\\rho"],
      },
      {
        latex: "\\gamma",
        class: "hide-shift",
        shift: "\\Gamma",
        variants: ["\\gamma", "\\Gamma", "\\pi", "\\sigma", "\\Sigma", "\\phi", "\\varphi", "\\omega", "\\Omega"],
      },
      { label: "[backspace]", width: 2 },
    ],
    [
      "[-]",
      "[+]",
      "[=]",
      { label: ",", latex: ",", class: "hide-shift", shift: ";", variants: [",", ";", ":", "\\dots", "\\cdots", "\\,"] },
      "[.]",
      "[(]",
      "[)]",
      "[left]",
      "[right]",
      { label: "[action]", width: 1 },
    ],
  ],
};

// Secondary full-QWERTY layout for arbitrary variable names.
export const ALPHABETIC_LAYOUT: VirtualKeyboardLayout = {
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

export const KEYBOARD_LAYOUTS: (VirtualKeyboardName | VirtualKeyboardLayout)[] = [
  MATH_LAYOUT,
  ALPHABETIC_LAYOUT,
  "symbols",
  "greek",
];

export type OutputFormat = "display" | "align" | "plain";

export interface LatexLineValue {
  latex: string;
}

/**
 * Strips MathLive `\placeholder` wrappers while keeping any text inside them.
 */
export function exportLatex(latex: string): string {
  return latex.replace(/\\placeholder(?:\[[^\]]*\])?\{([^{}]*)\}/g, "$1").trim();
}

/**
 * Formats non-empty lines into the selected LaTeX document output wrapper.
 */
export function buildOutput(lines: readonly LatexLineValue[], format: OutputFormat): string {
  const values = lines.map((line) => exportLatex(line.latex)).filter(Boolean);
  if (values.length === 0) return "";
  if (format === "plain") return values.join("\n");
  if (format === "display") return values.map((value) => `$$\n${value}\n$$`).join("\n\n");
  return `\\begin{align*}\n${values.map((value) => `  ${value}`).join(" \\\\\n")}\n\\end{align*}`;
}

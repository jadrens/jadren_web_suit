export interface GrammarCorrection { reference: number; original: string; replacement: string }

const ANNOTATION = /\[([^\[\]]+)]\(([^()]*)\)\{([^{}]+)\}/g;

export function validateGrammarMarkup(value: string) {
  const corrections: GrammarCorrection[] = [];
  for (const match of value.matchAll(ANNOTATION)) {
    const reference = Number(match[3]);
    if (!Number.isInteger(reference) || reference < 1 || reference !== corrections.length + 1) {
      throw new Error("Grammar references must be consecutive positive integers starting at {1}");
    }
    corrections.push({ reference, original: match[1], replacement: match[2] });
  }
  const allReferences = [...value.matchAll(/\{([^{}]*)\}/g)];
  if (allReferences.length !== corrections.length) {
    throw new Error("Every grammar reference must use [error](correction){n}");
  }
  return corrections;
}

export type GrammarMarkupPart =
  | { type: "text"; value: string }
  | { type: "correction"; original: string; replacement: string; reference: number };

export function parseGrammarMarkup(value: string): GrammarMarkupPart[] {
  const parts: GrammarMarkupPart[] = [];
  let cursor = 0;
  for (const match of value.matchAll(ANNOTATION)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ type: "text", value: value.slice(cursor, index) });
    parts.push({ type: "correction", original: match[1], replacement: match[2], reference: Number(match[3]) });
    cursor = index + match[0].length;
  }
  if (cursor < value.length) parts.push({ type: "text", value: value.slice(cursor) });
  return parts;
}

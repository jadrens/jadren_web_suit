export interface GrammarCorrection { reference: number; original: string; replacement: string }

const NEW_ANNOTATION = /\\delete\{([^{}]*)\}\\correction\{([^{}]*)\}\\\{([^{}]+)\}/g;

interface AnnotationMatch extends GrammarCorrection { index: number; length: number }

function collectAnnotations(value: string): AnnotationMatch[] {
  return [...value.matchAll(NEW_ANNOTATION)].map((match) => ({
    index: match.index ?? 0,
    length: match[0].length,
    original: match[1],
    replacement: match[2],
    reference: Number(match[3]),
  }));
}

export function validateGrammarMarkup(value: string) {
  const corrections = collectAnnotations(value);
  if (!corrections.length) throw new Error("No grammar corrections were found");
  for (const [index, correction] of corrections.entries()) {
    const { reference } = correction;
    if (!Number.isInteger(reference) || reference < 1 || reference !== index + 1) {
      throw new Error("Grammar references must be consecutive positive integers starting at {1}");
    }
  }
  const referenceCount = [...value.matchAll(/\\\{([^{}]*)\}/g)].length;
  if (referenceCount !== corrections.length) {
    throw new Error("Every grammar reference must use \\delete{error}\\correction{correction}\\{n}");
  }
  return corrections.map(({ reference, original, replacement }) => ({ reference, original, replacement }));
}

export type GrammarMarkupPart =
  | { type: "text"; value: string }
  | { type: "correction"; original: string; replacement: string; reference: number };

export function parseGrammarMarkup(value: string): GrammarMarkupPart[] {
  const parts: GrammarMarkupPart[] = [];
  let cursor = 0;
  for (const match of collectAnnotations(value)) {
    const index = match.index;
    if (index > cursor) parts.push({ type: "text", value: value.slice(cursor, index) });
    parts.push({ type: "correction", original: match.original, replacement: match.replacement, reference: match.reference });
    cursor = index + match.length;
  }
  if (cursor < value.length) parts.push({ type: "text", value: value.slice(cursor) });
  return parts;
}

export function grammarMarkupToCorrectedText(value: string) {
  return parseGrammarMarkup(value).map((part) => part.type === "text" ? part.value : part.replacement).join("");
}

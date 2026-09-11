export interface GrammarCorrection { reference: number; original: string; replacement: string }

const HTML_ANNOTATION = /<del>([^<>]*)<\/del><ins>([^<>]*)<\/ins><sup>([1-9]\d*)<\/sup>/g;
// Read existing history entries; new tool output must use HTML annotations.
const LEGACY_ANNOTATION = /\\delete\{([^{}]*)\}\\correction\{([^{}]*)\}\\\{([^{}]+)\}/g;

function decodeText(value: string) {
  const entities: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
  return value.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => entities[entity]);
}

interface AnnotationMatch extends GrammarCorrection { index: number; length: number }

function collectAnnotations(value: string, legacy = false): AnnotationMatch[] {
  return [...value.matchAll(legacy ? LEGACY_ANNOTATION : HTML_ANNOTATION)].map((match) => ({
    index: match.index ?? 0,
    length: match[0].length,
    original: legacy ? match[1] : decodeText(match[1]),
    replacement: legacy ? match[2] : decodeText(match[2]),
    reference: Number(match[3]),
  }));
}

export function validateGrammarMarkup(value: string) {
  const corrections = collectAnnotations(value);
  if (!corrections.length) throw new Error("No grammar corrections were found");
  for (const [index, correction] of corrections.entries()) {
    const { reference } = correction;
    if (!Number.isInteger(reference) || reference < 1 || reference !== index + 1) {
      throw new Error("Grammar references must be consecutive positive integers starting at 1");
    }
  }
  if (/[<>]/.test(value.replace(HTML_ANNOTATION, ""))) {
    throw new Error("Every correction must use <del>original</del><ins>replacement</ins><sup>n</sup>; encode literal &, < and > as &amp;, &lt; and &gt;");
  }
  return corrections.map(({ reference, original, replacement }) => ({ reference, original, replacement }));
}

export type GrammarMarkupPart =
  | { type: "text"; value: string }
  | { type: "correction"; original: string; replacement: string; reference: number };

export function parseGrammarMarkup(value: string): GrammarMarkupPart[] {
  const parts: GrammarMarkupPart[] = [];
  const legacy = !value.includes("<del>") && LEGACY_ANNOTATION.test(value);
  LEGACY_ANNOTATION.lastIndex = 0;
  const text = legacy ? (text: string) => text : decodeText;
  let cursor = 0;
  for (const match of collectAnnotations(value, legacy)) {
    const index = match.index;
    if (index > cursor) parts.push({ type: "text", value: text(value.slice(cursor, index)) });
    parts.push({ type: "correction", original: match.original, replacement: match.replacement, reference: match.reference });
    cursor = index + match.length;
  }
  if (cursor < value.length) parts.push({ type: "text", value: text(value.slice(cursor)) });
  return parts;
}

export function grammarMarkupToCorrectedText(value: string) {
  return parseGrammarMarkup(value).map((part) => part.type === "text" ? part.value : part.replacement).join("");
}

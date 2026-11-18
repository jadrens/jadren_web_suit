/**
 * Pure page-ordering logic for 2-up imposition. No PDF I/O.
 *
 * Port of `pdf_tool/src/pdf_tool/imposition.py`. Everything works on 1-based
 * source page numbers; `null` marks a padding blank. Keeping this module free
 * of PDF dependencies lets the live preview recompute synchronously.
 */

/** One sheet of paper printed duplex holds 2 sides x 2 pages. */
export const PAGES_PER_SHEET = 4;

export type Slot = number | null;

export type Layout = "booklet" | "two_up" | "single_fold";

export const LAYOUTS: Layout[] = ["booklet", "single_fold", "two_up"];

/** User-facing error codes; the UI turns these into localized messages. */
export type ImpositionErrorCode =
  | "emptyPdf"
  | "invalidSplitEvery"
  | "invalidSplitAt"
  | "splitOutOfRange"
  | "encrypted"
  | "invalidPdf";

export class ImpositionError extends Error {
  readonly code: ImpositionErrorCode;

  constructor(code: ImpositionErrorCode) {
    super(code);
    this.name = "ImpositionError";
    this.code = code;
  }
}

export interface Options {
  layout: Layout;
  /** Right-to-left binding: swap the halves of every output page. */
  rtl: boolean;
  /** Split into volumes of this many pages; 0 disables. Ignored if splitAt is set. */
  splitEvery: number;
  /** Explicit volume boundaries: each value is the last page of a volume. */
  splitAt: number[];
  /** Stamp "n / total" on every source page before imposing. */
  pageNumbers: boolean;
  /** Print the output page index and mark padding blanks. */
  sheetLabels: boolean;
}

export const defaultOptions: Options = {
  layout: "booklet",
  rtl: false,
  splitEvery: 80,
  splitAt: [],
  pageNumbers: true,
  sheetLabels: true,
};

/** One output file: a run of output pages, each a (left, right) pair. */
export interface Volume {
  index: number;
  sides: [Slot, Slot][];
  first: number;
  last: number;
}

function validate(options: Options): void {
  if (options.splitEvery < 0 || options.splitEvery % PAGES_PER_SHEET !== 0) {
    throw new ImpositionError("invalidSplitEvery");
  }
  if (options.splitAt.some((p) => p <= 0 || p % PAGES_PER_SHEET !== 0)) {
    throw new ImpositionError("invalidSplitAt");
  }
}

/**
 * Pad to a whole number of sheets, inserting blanks before the last page.
 * The last page is usually the back cover, so it must stay last.
 */
export function padPages(pageCount: number): Slot[] {
  if (pageCount <= 0) throw new ImpositionError("emptyPdf");
  const blanks = (PAGES_PER_SHEET - (pageCount % PAGES_PER_SHEET)) % PAGES_PER_SHEET;
  const padded: Slot[] = [];
  for (let p = 1; p < pageCount; p++) padded.push(p);
  for (let i = 0; i < blanks; i++) padded.push(null);
  padded.push(pageCount);
  return padded;
}

/** Split `total` padded pages into `[start, end)` ranges. */
function volumeBounds(total: number, options: Options): [number, number][] {
  if (options.layout === "single_fold") return [[0, total]];

  let cuts: number[];
  if (options.splitAt.length > 0) {
    if (options.splitAt.some((p) => p > total)) {
      throw new ImpositionError("splitOutOfRange");
    }
    cuts = [...new Set(options.splitAt.filter((p) => p < total))].sort((a, b) => a - b);
  } else if (options.splitEvery > 0) {
    cuts = [];
    for (let p = options.splitEvery; p < total; p += options.splitEvery) cuts.push(p);
  } else {
    cuts = [];
  }

  const edges = [0, ...cuts, total];
  const bounds: [number, number][] = [];
  for (let i = 0; i + 1 < edges.length; i++) bounds.push([edges[i], edges[i + 1]]);
  return bounds;
}

/** Local indices (0-based) for each output page of a `length`-page volume. */
export function sideOrder(length: number, layout: Layout): [number, number][] {
  const sides: [number, number][] = [];
  if (layout === "two_up") {
    for (let i = 0; i < length; i += 2) sides.push([i, i + 1]);
  } else if (layout === "single_fold") {
    for (let base = 0; base < length; base += PAGES_PER_SHEET) {
      sides.push([base + 3, base]);
      sides.push([base + 1, base + 2]);
    }
  } else {
    for (let i = 0; i < Math.floor(length / 2); i++) {
      const outer = length - 1 - i;
      const inner = i;
      sides.push(i % 2 === 0 ? [outer, inner] : [inner, outer]);
    }
  }
  return sides;
}

export function plan(pageCount: number, options: Options): Volume[] {
  validate(options);
  const padded = padPages(pageCount);
  return volumeBounds(padded.length, options).map(([start, end], idx) => {
    const chunk = padded.slice(start, end);
    const sides = sideOrder(chunk.length, options.layout).map(
      ([l, r]): [Slot, Slot] => {
        const pair: [Slot, Slot] = [chunk[l], chunk[r]];
        return options.rtl ? [pair[1], pair[0]] : pair;
      },
    );

    let first = 0;
    let last = 0;
    let seen = false;
    for (const [l, r] of sides) {
      for (const p of [l, r]) {
        if (p === null) continue;
        if (!seen) {
          first = p;
          last = p;
          seen = true;
        } else {
          if (p < first) first = p;
          if (p > last) last = p;
        }
      }
    }

    return { index: idx + 1, sides, first, last };
  });
}

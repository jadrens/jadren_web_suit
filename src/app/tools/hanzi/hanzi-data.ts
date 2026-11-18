/**
 * Data and search helpers for the Hanzi lookup tool.
 *
 * The tool ships Unicode's own Han database rather than scraping a dictionary:
 * kRSUnicode / kTotalStrokes / kMandarin / kIRG_*Source come from Unihan,
 * Kangxi radical numbers come from CJKRadicals.txt, and the review states of
 * unencoded glyphs come from UAX #45's USourceData.txt. IDS data comes from the
 * cjkvi-ids project (derived from the CHISE IDS database).
 *
 * Everything is compressed with gzip because Next serves public/ files as-is;
 * core.json.gz is fetched on page load, details.json.gz (definitions, IDS,
 * variants) is fetched once in the background.
 */

export interface RadicalInfo {
  key: string;
  radical: string;
  ideograph: string;
  strokes: number;
}

export interface USourceEntry {
  id: string;
  status: string;
  codepoint: string;
  rs: string;
  position: string;
  ids: string;
  sources: string;
  comment: string;
  strokes: string;
  firstStroke: string;
}

export interface HanziCore {
  version: string;
  built: string;
  chars: string[];
  radicalStrokes: string[];
  totalStrokes: number[];
  sourceMasks: number[];
  pinyin: (string | undefined)[];
  usourceLinks: Map<number, string>;
  radicals: RadicalInfo[];
  usource: USourceEntry[];
  index: Map<string, number>;
  usourceById: Map<string, USourceEntry>;
  byRadical: Map<string, Map<number, number[]>>;
  byStrokes: Map<number, number[]>;
  pinyinIndex: Map<string, number[]>;
}

export interface VariantGroups {
  s?: string[];
  t?: string[];
  v?: string[];
  z?: string[];
  c?: string[];
}

export interface HanziDetails {
  version: string;
  ids: Map<number, string[]>;
  definitions: Map<number, string>;
  variants: Map<number, VariantGroups>;
  multiRs: Map<number, string>;
}

export const IDS_OPERATORS = ["⿰", "⿱", "⿲", "⿳", "⿴", "⿵", "⿶", "⿷", "⿸", "⿹", "⿺", "⿻"] as const;

const IDS_ARITY: Record<string, number> = {
  "⿰": 2,
  "⿱": 2,
  "⿴": 2,
  "⿵": 2,
  "⿶": 2,
  "⿷": 2,
  "⿸": 2,
  "⿹": 2,
  "⿺": 2,
  "⿻": 2,
  "⿼": 2,
  "⿽": 2,
  "⿾": 1,
  "⿿": 1,
  "⿲": 3,
  "⿳": 3,
};

export type IdsNode = { atom: string } | { op: string; children: IdsNode[] };

export const REGION_BITS = [
  { bit: 1, key: "G" },
  { bit: 2, key: "T" },
  { bit: 4, key: "J" },
  { bit: 8, key: "K" },
  { bit: 16, key: "KP" },
  { bit: 32, key: "H" },
  { bit: 64, key: "M" },
  { bit: 128, key: "V" },
  { bit: 256, key: "UK" },
  { bit: 512, key: "S" },
  { bit: 1024, key: "U" },
] as const;

const SRC_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";

/** Tone-marked vowels, mapped to an ASCII base letter plus tone digit. */
const TONE_MARKS: Record<string, string> = {
  ā: "a1", á: "a2", ǎ: "a3", à: "a4",
  ē: "e1", é: "e2", ě: "e3", è: "e4",
  ī: "i1", í: "i2", ǐ: "i3", ì: "i4",
  ō: "o1", ó: "o2", ǒ: "o3", ò: "o4",
  ū: "u1", ú: "u2", ǔ: "u3", ù: "u4",
  ǖ: "v1", ǘ: "v2", ǚ: "v3", ǜ: "v4",
  ü: "v",
  ê: "e",
};

export function toneKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((syllable) => {
      let base = "";
      let tone = "";
      for (const character of syllable) {
        const marked = TONE_MARKS[character];
        if (marked) {
          base += marked[0];
          tone = marked.slice(1) || tone;
        } else {
          base += character;
        }
      }
      return base + tone;
    })
    .join("");
}

function readingKeys(value: string): string[] {
  return Array.from(new Set(value.split(/\s+/).filter(Boolean).map(toneKey)));
}

function parseRadicalValue(value: string): { key: string; residual: number } {
  const match = /^(\d+)(\'*)\.(\d+)$/.exec(value);
  if (!match) return { key: value, residual: 0 };
  return { key: `${match[1]}${match[2]}`, residual: Number(match[3]) };
}

async function fetchGzipJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const { gunzipSync, strFromU8 } = await import("fflate");
  return JSON.parse(strFromU8(gunzipSync(bytes))) as T;
}

export interface RawCore {
  version: string;
  built: string;
  chars: string;
  rs: string;
  ts: string;
  src: string;
  py: Record<string, string>;
  ul: Record<string, string>;
  radicals: [string, string, string, number][];
  u: string[][];
}

export interface RawDetails {
  version: string;
  ids: Record<string, string>;
  def: Record<string, string>;
  vars: Record<string, VariantGroups>;
  rsAll: Record<string, string>;
}

let corePromise: Promise<HanziCore> | null = null;
let detailsPromise: Promise<HanziDetails> | null = null;

export function loadCore(): Promise<HanziCore> {
  corePromise ??= fetchGzipJson<RawCore>("/hanzi/core.json.gz").then(parseCore).catch((error) => {
    corePromise = null;
    throw error;
  });
  return corePromise;
}

export function loadDetails(): Promise<HanziDetails> {
  if (!detailsPromise) {
    detailsPromise = fetchGzipJson<RawDetails>("/hanzi/details.json.gz")
      .then(parseDetails)
      .catch((error) => {
        detailsPromise = null;
        throw error;
      });
  }
  return detailsPromise;
}

export function parseDetails(raw: RawDetails): HanziDetails {
  return {
    version: raw.version,
    ids: toNumberMap(raw.ids, (value) => value.split("\t").filter(Boolean)),
    definitions: toNumberMap(raw.def, (value) => value),
    variants: toNumberMap(raw.vars, (value) => value),
    multiRs: toNumberMap(raw.rsAll, (value) => value),
  };
}

function toNumberMap<Raw, Value>(record: Record<string, Raw>, transform: (value: Raw) => Value): Map<number, Value> {
  const map = new Map<number, Value>();
  for (const [key, value] of Object.entries(record)) {
    map.set(Number(key), transform(value));
  }
  return map;
}

export function parseCore(raw: RawCore): HanziCore {
  const chars = Array.from(raw.chars);
  const radicalStrokes = raw.rs.split(",");
  const totalStrokes = raw.ts.split(",").map((value) => Number(value));
  const sourceMasks = new Array<number>(chars.length);
  for (let index = 0; index < chars.length; index += 1) {
    const a = SRC_ALPHABET.indexOf(raw.src[index * 2] ?? "0");
    const b = SRC_ALPHABET.indexOf(raw.src[index * 2 + 1] ?? "0");
    sourceMasks[index] = a * 64 + b;
  }

  const index = new Map<string, number>();
  chars.forEach((character, position) => index.set(character, position));

  const pinyin: (string | undefined)[] = new Array(chars.length);
  for (const [key, value] of Object.entries(raw.py)) pinyin[Number(key)] = value;

  const usourceLinks = new Map<number, string>();
  for (const [key, value] of Object.entries(raw.ul)) usourceLinks.set(Number(key), value);

  const radicals: RadicalInfo[] = raw.radicals.map(([key, radical, ideograph, strokes]) => ({
    key,
    radical,
    ideograph,
    strokes,
  }));

  const usource: USourceEntry[] = raw.u.map((fields) => ({
    id: fields[0],
    status: fields[1],
    codepoint: fields[2],
    rs: fields[3],
    position: fields[4],
    ids: fields[5],
    sources: fields[6],
    comment: fields[7],
    strokes: fields[8],
    firstStroke: fields[9],
  }));
  const usourceById = new Map(usource.map((entry) => [entry.id, entry]));

  const byRadical = new Map<string, Map<number, number[]>>();
  const byStrokes = new Map<number, number[]>();
  const pinyinIndex = new Map<string, number[]>();

  chars.forEach((_, position) => {
    const { key, residual } = parseRadicalValue(radicalStrokes[position]);
    let group = byRadical.get(key);
    if (!group) byRadical.set(key, (group = new Map()));
    const residualGroup = group.get(residual);
    if (residualGroup) residualGroup.push(position);
    else group.set(residual, [position]);

    const strokes = totalStrokes[position];
    const strokeGroup = byStrokes.get(strokes);
    if (strokeGroup) strokeGroup.push(position);
    else byStrokes.set(strokes, [position]);

    const reading = pinyin[position];
    if (reading) {
      for (const tone of readingKeys(reading)) {
        const group = pinyinIndex.get(tone);
        if (group) group.push(position);
        else pinyinIndex.set(tone, [position]);
      }
    }
  });

  // Each bucket keeps Unicode code point order; sort by stroke count so grids
  // read like a dictionary page, then by code point for a stable order.
  for (const group of byRadical.values()) {
    for (const [residual, positions] of group) {
      positions.sort((a, b) => totalStrokes[a] - totalStrokes[b] || a - b);
      group.set(residual, positions);
    }
  }

  return {
    version: raw.version,
    built: raw.built,
    chars,
    radicalStrokes,
    totalStrokes,
    sourceMasks,
    pinyin,
    usourceLinks,
    radicals,
    usource,
    index,
    usourceById,
    byRadical,
    byStrokes,
    pinyinIndex,
  };
}

export function codepointOf(core: HanziCore, index: number): number {
  return core.chars[index].codePointAt(0) ?? 0;
}

export function formatCodepoint(codepoint: number): string {
  return `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** USourceData field 2 can hold several code points, or a U-source id for duplicates. */
export function codepointCharacters(value: string): string[] {
  return [...value.matchAll(/U\+([0-9A-F]{4,6})/g)].map((match) => String.fromCodePoint(Number.parseInt(match[1], 16)));
}

export function codepointFromText(value: string): number | null {
  const trimmed = value.trim();
  const prefixed = /^U\+([0-9A-Fa-f]{4,6})$/.exec(trimmed);
  if (prefixed) return Number.parseInt(prefixed[1], 16);
  if (/^[0-9A-Fa-f]{4,6}$/.test(trimmed) && /[0-9]/.test(trimmed)) {
    return Number.parseInt(trimmed, 16);
  }
  return null;
}

export function radicalOf(core: HanziCore, index: number) {
  return parseRadicalValue(core.radicalStrokes[index]);
}

export function residualGroups(core: HanziCore, radicalKey: string): { residual: number; count: number }[] {
  const group = core.byRadical.get(radicalKey);
  if (!group) return [];
  return [...group.entries()]
    .map(([residual, positions]) => ({ residual, count: positions.length }))
    .sort((a, b) => a.residual - b.residual);
}

/**
 * Common characters live in the URO, then Ext A. Compatibility ideographs and
 * the later extensions are progressively rarer; sorting by this rank keeps a
 * radical list from opening on a wall of Ext G/H glyphs.
 */
function commonnessRank(core: HanziCore, index: number): number {
  const codepoint = codepointOf(core, index);
  if (codepoint >= 0x4e00 && codepoint <= 0x9fff) return 0;
  if (codepoint >= 0x3400 && codepoint <= 0x4dbf) return 1;
  if (codepoint >= 0xf900 && codepoint <= 0xfaff) return 2;
  if (codepoint >= 0x20000 && codepoint < 0x30000) return 3;
  if (codepoint >= 0x30000) return 4;
  return 2;
}

function byCommonness(core: HanziCore, a: number, b: number): number {
  return commonnessRank(core, a) - commonnessRank(core, b) || core.totalStrokes[a] - core.totalStrokes[b] || a - b;
}

export function charactersForRadical(core: HanziCore, radicalKey: string, residual: number | null): number[] {
  const group = core.byRadical.get(radicalKey);
  if (!group) return [];
  if (residual !== null) return [...(group.get(residual) ?? [])].sort((a, b) => byCommonness(core, a, b));
  return [...group.values()].flat().sort((a, b) => byCommonness(core, a, b));
}

export function searchPinyin(core: HanziCore, query: string): number[] {
  const key = toneKey(query).replace(/[^a-z0-9]/g, "");
  if (!key) return [];
  const hasTone = /\d$/.test(key);
  const results = new Set<number>();
  for (const [reading, positions] of core.pinyinIndex) {
    const matches = hasTone ? reading === key : reading.startsWith(key);
    if (matches) positions.forEach((position) => results.add(position));
  }
  return [...results].sort((a, b) => {
    const left = core.pinyin[a] ?? "";
    const right = core.pinyin[b] ?? "";
    return left.localeCompare(right) || byCommonness(core, a, b);
  });
}

export function charactersForStrokes(core: HanziCore, strokes: number): number[] {
  return [...(core.byStrokes.get(strokes) ?? [])].sort((a, b) => byCommonness(core, a, b));
}

/* ------------------------------------------------------------------ IDS --- */

export function parseIds(value: string): IdsNode | null {
  const text = value.replace(/\s+/g, "");
  if (!text) return null;
  let position = 0;

  const parseNode = (): IdsNode | null => {
    if (position >= text.length) return null;
    const character = text[position];
    const arity = IDS_ARITY[character];
    if (arity) {
      position += 1;
      const children: IdsNode[] = [];
      for (let index = 0; index < arity; index += 1) {
        const child = parseNode();
        if (!child) return null;
        children.push(child);
      }
      return { op: character, children };
    }
    if (IDS_ARITY[character] === undefined && /[\u2FF0-\u2FFF]/.test(character)) return null;
    // Step by code point: Ext B+ components (𠂊, 𦥑, …) are surrogate pairs.
    const atom = String.fromCodePoint(text.codePointAt(position) ?? 0);
    position += atom.length;
    return { atom };
  };

  const node = parseNode();
  return node && position === text.length ? node : null;
}

export function idsLeaves(node: IdsNode): string[] {
  if ("atom" in node) return [node.atom];
  return node.children.flatMap(idsLeaves);
}

/** Position of a node: child indices from the root ([] = root). */
export type IdsPath = number[];

export function serializeIds(node: IdsNode): string {
  return "atom" in node ? node.atom : node.op + node.children.map(serializeIds).join("");
}

export function idsNodeAt(node: IdsNode, path: IdsPath): IdsNode | null {
  let current: IdsNode = node;
  for (const step of path) {
    if (!("op" in current) || !current.children[step]) return null;
    current = current.children[step];
  }
  return current;
}

export function replaceIdsNode(node: IdsNode, path: IdsPath, replacement: IdsNode): IdsNode {
  if (!path.length) return replacement;
  if (!("op" in node)) return node;
  const [step, ...rest] = path;
  return { op: node.op, children: node.children.map((child, index) => (index === step ? replaceIdsNode(child, rest, replacement) : child)) };
}

/** Wildcard slots ("*" / "?") in reading order — where the editor moves next after filling one. */
export function idsWildcardPaths(node: IdsNode, path: IdsPath = []): IdsPath[] {
  if ("atom" in node) return node.atom === "*" || node.atom === "?" ? [path] : [];
  return node.children.flatMap((child, index) => idsWildcardPaths(child, [...path, index]));
}

export function idsArity(operator: string): number {
  return IDS_ARITY[operator] ?? 0;
}

export function hasIdsOperator(value: string): boolean {
  return /[\u2FF0-\u2FFF]/.test(value);
}

/** Structural match; `?` accepts one undivided component, `*` accepts anything (component or structure). */
export function idsMatches(node: IdsNode, pattern: IdsNode): boolean {
  if ("atom" in pattern) {
    if (pattern.atom === "*") return true;
    if (pattern.atom === "?") return "atom" in node;
    return "atom" in node && node.atom === pattern.atom;
  }
  if (!("op" in node)) return false;
  if (node.op !== pattern.op || node.children.length !== pattern.children.length) return false;
  return pattern.children.every((child, index) => idsMatches(node.children[index], child));
}

/** cjkvi-ids appends source-region tags to variants ("⿰亻内[G]"); they are not components. */
const SOURCE_TAGS = /\[[A-Z]+\]|"/g;

export function cleanIdsVariant(value: string): string {
  return value.replace(SOURCE_TAGS, "").replace(/\s+/g, "");
}

/** U-source IDS mark the unencoded indicator 〾 and cite unencoded parts as "[P5-02]"; keep those as "?". */
function cleanUSourceIds(value: string): string {
  return cleanIdsVariant(value).replace(/〾/g, "").replace(/\[[^\]]*\]/g, "?");
}

/**
 * Parse an IDS that may still be being typed: missing operands are filled with "*", so "⿰女"
 * searches as "⿰女*". Returns null for text with trailing extras or no operator at all.
 */
export function completeIds(value: string): string | null {
  const text = value.replace(/\s+/g, "");
  if (!hasIdsOperator(text)) return null;
  let position = 0;
  let out = "";
  const walk = (): boolean => {
    if (position >= text.length) {
      out += "*";
      return true;
    }
    const character = text[position];
    const arity = IDS_ARITY[character];
    if (arity) {
      position += 1;
      out += character;
      for (let index = 0; index < arity; index += 1) walk();
      return true;
    }
    if (/[\u2FF0-\u2FFF]/.test(character)) return false;
    const codepoint = text.codePointAt(position) ?? 0;
    const atom = String.fromCodePoint(codepoint);
    position += atom.length;
    out += atom;
    return true;
  };
  if (!walk() || position !== text.length) return null;
  return parseIds(out) ? out : null;
}

function countParts(parts: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const part of parts) counts.set(part, (counts.get(part) ?? 0) + 1);
  return counts;
}

function containsCounts(counts: Map<string, number>, required: Map<string, number>): boolean {
  for (const [part, count] of required) if ((counts.get(part) ?? 0) < count) return false;
  return true;
}

function sameCounts(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [part, count] of a) if (b.get(part) !== count) return false;
  return true;
}

export interface IdsIndex {
  /** Parsed decompositions per character (tags stripped, unparsable variants dropped). */
  trees: Map<number, IdsNode[]>;
  /** Every component at every depth, repeats kept (品 → 口 吅 口 口), by recursive decomposition. */
  parts: Map<number, string[]>;
  /** Component → characters whose parts include it. */
  postings: Map<string, number[]>;
  usource: { entry: USourceEntry; tree: IdsNode | null; parts: string[] }[];
}

const idsIndexCache = new WeakMap<HanziDetails, IdsIndex>();
const MAX_DEPTH = 10;
const SLICE = 2_000;

/** The index build as resumable steps: yields every SLICE characters so callers can spread the work. */
function* indexSteps(core: HanziCore, details: HanziDetails): Generator<void, IdsIndex> {
  const trees = new Map<number, IdsNode[]>();
  let step = 0;
  for (const [index, variants] of details.ids) {
    const parsed: IdsNode[] = [];
    for (const variant of variants) {
      const tree = parseIds(cleanIdsVariant(variant));
      if (tree) parsed.push(tree);
    }
    if (parsed.length) trees.set(index, parsed);
    if (++step % (SLICE * 4) === 0) yield;
  }

  // Components decompose through their own (first) IDS; atomic entries ("口" → 口) stop the descent.
  const memo = new Map<string, string[]>();
  const active = new Set<string>();
  const NONE: string[] = [];
  const expandComponent = (component: string, depth: number): string[] => {
    const known = memo.get(component);
    if (known) return known;
    const index = core.index.get(component);
    const tree = index === undefined ? undefined : trees.get(index)?.[0];
    if (!tree || "atom" in tree || active.has(component) || depth > MAX_DEPTH) return NONE;
    active.add(component);
    const parts = partsOfTree(tree, depth + 1);
    active.delete(component);
    memo.set(component, parts);
    return parts;
  };
  const partsOfTree = (tree: IdsNode, depth: number): string[] => {
    const parts: string[] = [];
    for (const leaf of idsLeaves(tree)) {
      if (leaf === "?" || leaf === "*") continue;
      parts.push(leaf);
      for (const part of expandComponent(leaf, depth)) parts.push(part);
    }
    return parts;
  };

  const parts = new Map<number, string[]>();
  const postings = new Map<string, number[]>();
  const seen = new Set<string>();
  step = 0;
  for (const [index, list] of trees) {
    const structural = list.filter((tree) => "op" in tree);
    if (!structural.length) continue;
    let flat: string[];
    if (structural.length === 1) {
      flat = partsOfTree(structural[0], 0);
    } else {
      // Regional variants can differ; keep, per component, the highest count any variant gives.
      const merged = new Map<string, number>();
      for (const tree of structural) {
        for (const [part, count] of countParts(partsOfTree(tree, 0))) merged.set(part, Math.max(merged.get(part) ?? 0, count));
      }
      flat = [];
      for (const [part, count] of merged) for (let repeat = 0; repeat < count; repeat += 1) flat.push(part);
    }
    parts.set(index, flat);
    seen.clear();
    for (const part of flat) {
      if (seen.has(part)) continue;
      seen.add(part);
      const list = postings.get(part);
      if (list) list.push(index);
      else postings.set(part, [index]);
    }
    if (++step % SLICE === 0) yield;
  }

  const usource = core.usource
    .filter((entry) => entry.ids)
    .map((entry) => {
      const tree = parseIds(cleanUSourceIds(entry.ids));
      return { entry, tree, parts: tree && "op" in tree ? partsOfTree(tree, 0) : [] };
    });

  return { trees, parts, postings, usource };
}

/** Synchronous build (tests, scripts). Cached per loaded dataset. */
export function buildIdsIndex(core: HanziCore, details: HanziDetails): IdsIndex {
  const cached = idsIndexCache.get(details);
  if (cached) return cached;
  const steps = indexSteps(core, details);
  let next = steps.next();
  while (!next.done) next = steps.next();
  idsIndexCache.set(details, next.value);
  return next.value;
}

/** Browser build: runs in ~8 ms slices between frames so typing and scrolling stay responsive. */
export async function buildIdsIndexAsync(core: HanziCore, details: HanziDetails, signal?: AbortSignal): Promise<IdsIndex> {
  const cached = idsIndexCache.get(details);
  if (cached) return cached;
  const steps = indexSteps(core, details);
  let next = steps.next();
  while (!next.done) {
    const sliceStart = performance.now();
    while (!next.done && performance.now() - sliceStart < 8) next = steps.next();
    if (next.done) break;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  }
  idsIndexCache.set(details, next.value);
  return next.value;
}

export interface IdsSearchResult {
  characters: number[];
  /** Matches before `limit` was applied. */
  total: number;
  usource: USourceEntry[];
  /** The structural pattern actually searched, when the query was an unfinished IDS ("⿰女" → "⿰女*"). */
  completed: string | null;
}

const EMPTY_RESULT: IdsSearchResult = { characters: [], total: 0, usource: [], completed: null };

/**
 * Search the IDS index.
 *
 * A query with an IDS operator matches structurally — the whole decomposition first, then structures
 * nested inside it. A plain run of components matches characters containing all of them at any depth,
 * counting repeats (口口口 needs three 口). Exact decompositions rank first, then direct components.
 */
export function searchIds(
  core: HanziCore,
  index: IdsIndex | null,
  query: string,
  limit = 600,
): IdsSearchResult {
  const text = cleanIdsVariant(query);
  if (!text || !index) return EMPTY_RESULT;
  const ranked: { index: number; score: number; extra: number }[] = [];
  let usource: USourceEntry[] = [];
  let completed: string | null = null;

  if (hasIdsOperator(text)) {
    const exact = parseIds(text) ? text : null;
    const patternText = exact ?? completeIds(text);
    const pattern = patternText ? parseIds(patternText) : null;
    if (!pattern) return EMPTY_RESULT;
    if (!exact) completed = patternText;
    // Nested matches also look inside components' own decompositions (想 = ⿱相心 contains ⿰木目 via 相).
    const componentHas = new Map<string, boolean>();
    const containsDeep = (node: IdsNode, depth: number): boolean => {
      if (idsMatches(node, pattern)) return true;
      if ("op" in node) return node.children.some((child) => containsDeep(child, depth));
      const known = componentHas.get(node.atom);
      if (known !== undefined) return known;
      if (depth >= MAX_DEPTH) return false;
      componentHas.set(node.atom, false); // cycle guard
      const charIndex = core.index.get(node.atom);
      const tree = charIndex === undefined ? undefined : index.trees.get(charIndex)?.[0];
      const found = Boolean(tree && "op" in tree && containsDeep(tree, depth + 1));
      componentHas.set(node.atom, found);
      return found;
    };
    for (const [charIndex, trees] of index.trees) {
      let best = Number.POSITIVE_INFINITY;
      for (const tree of trees) {
        if (idsMatches(tree, pattern)) best = Math.min(best, 1);
        else if (best > 2 && "op" in tree && tree.children.some((child) => containsDeep(child, 0))) best = 2;
      }
      if (Number.isFinite(best)) ranked.push({ index: charIndex, score: best, extra: 0 });
    }
    usource = index.usource
      .filter((item) => item.tree && containsDeep(item.tree, 0))
      .map((item) => item.entry);
  } else {
    const tokens = Array.from(text).filter((token) => token !== "?" && token !== "*");
    if (!tokens.length) return EMPTY_RESULT;
    const required = countParts(tokens);
    // Walk the shortest posting list and verify the rest against each candidate's parts.
    let candidates: number[] | undefined;
    for (const token of required.keys()) {
      const list = index.postings.get(token);
      if (!list) {
        candidates = [];
        break;
      }
      if (!candidates || list.length < candidates.length) candidates = list;
    }
    for (const charIndex of candidates ?? []) {
      const counts = countParts(index.parts.get(charIndex) ?? []);
      if (!containsCounts(counts, required)) continue;
      let score = 3;
      for (const tree of index.trees.get(charIndex) ?? []) {
        const direct = countParts(idsLeaves(tree));
        if (sameCounts(direct, required)) score = Math.min(score, 1);
        else if (containsCounts(direct, required)) score = Math.min(score, 2);
      }
      // Fewer leftover parts = a closer match (品 before 器 for 口口口).
      ranked.push({ index: charIndex, score, extra: (index.parts.get(charIndex)?.length ?? 0) - tokens.length });
    }
    usource = index.usource
      .filter((item) => containsCounts(countParts(item.parts), required))
      .map((item) => item.entry);
  }

  // Structures: exact matches before nested ones, then common characters first. Components: common
  // characters first (people mostly want URO hits), then exact decompositions, then closer matches.
  const structural = hasIdsOperator(text);
  ranked.sort((a, b) => {
    const tier = structural
      ? a.score - b.score || commonnessRank(core, a.index) - commonnessRank(core, b.index)
      : commonnessRank(core, a.index) - commonnessRank(core, b.index) || a.score - b.score;
    return tier || a.extra - b.extra || core.totalStrokes[a.index] - core.totalStrokes[b.index] || a.index - b.index;
  });
  return {
    characters: ranked.slice(0, limit).map((item) => item.index),
    total: ranked.length,
    usource: usource.slice(0, 120),
    completed,
  };
}

/* --------------------------------------------------------------- status --- */

export type StatusKind =
  | "encoded"
  | "pending"
  | "rejected"
  | "variant"
  | "other"
  | "duplicate";

export interface StatusInfo {
  kind: StatusKind;
  tone: "success" | "info" | "warning" | "error" | "default";
  extension?: string;
}

export function statusInfo(status: string): StatusInfo {
  if (/^Ext[A-Z]$/.test(status)) {
    return { kind: "encoded", tone: "success", extension: status.slice(3) };
  }
  if (status === "URO" || status === "Comp") return { kind: "encoded", tone: "success" };
  if (status === "FutureWS" || status === "WS-2024") return { kind: "pending", tone: "info" };
  if (status === "Rejected") return { kind: "rejected", tone: "error" };
  if (status === "Variant") return { kind: "variant", tone: "default" };
  if (status === "NoAction") return { kind: "other", tone: "warning" };
  if (/^(UTC|UK|UCI)-\d{5}$/.test(status)) return { kind: "duplicate", tone: "default" };
  return { kind: "other", tone: "default" };
}

export const U_STATUS_FILTERS = ["unencoded", "FutureWS", "WS-2024", "NoAction", "Rejected", "Variant", "encoded", "all"] as const;
export type UStatusFilter = (typeof U_STATUS_FILTERS)[number];

export function matchesUStatus(entry: USourceEntry, filter: UStatusFilter): boolean {
  const info = statusInfo(entry.status);
  if (filter === "all") return true;
  if (filter === "encoded") return info.kind === "encoded";
  if (filter === "unencoded") {
    return info.kind === "pending" || info.kind === "rejected" || info.kind === "other" || info.kind === "duplicate";
  }
  return entry.status === filter;
}

export interface UnicodeBlock {
  key: string;
  start: number;
  end: number;
}

const BLOCKS: UnicodeBlock[] = [
  { key: "radicalsSupplement", start: 0x2e80, end: 0x2eff },
  { key: "kangxiRadicals", start: 0x2f00, end: 0x2fdf },
  { key: "extA", start: 0x3400, end: 0x4dbf },
  { key: "uro", start: 0x4e00, end: 0x9fff },
  { key: "compatibility", start: 0xf900, end: 0xfaff },
  { key: "extB", start: 0x20000, end: 0x2a6df },
  { key: "extC", start: 0x2a700, end: 0x2b739 },
  { key: "extD", start: 0x2b740, end: 0x2b81d },
  { key: "extE", start: 0x2b820, end: 0x2cea1 },
  { key: "extF", start: 0x2ceb0, end: 0x2ebe0 },
  { key: "extI", start: 0x2ebf0, end: 0x2ee5d },
  { key: "compatibilitySupplement", start: 0x2f800, end: 0x2fa1d },
  { key: "extG", start: 0x30000, end: 0x3134a },
  { key: "extH", start: 0x31350, end: 0x323af },
  { key: "extJ", start: 0x323b0, end: 0x3347f },
];

export function unicodeBlock(codepoint: number): UnicodeBlock | null {
  return BLOCKS.find((block) => codepoint >= block.start && codepoint <= block.end) ?? null;
}

export function regionKeys(mask: number): string[] {
  return REGION_BITS.filter((region) => (mask & region.bit) !== 0).map((region) => region.key);
}

export function findUSourceById(core: HanziCore, value: string): USourceEntry | undefined {
  return core.usourceById.get(value.trim().toUpperCase());
}

export function findCharacter(core: HanziCore, value: string): number | null {
  const codepoint = codepointFromText(value);
  if (codepoint !== null) {
    const character = String.fromCodePoint(codepoint);
    return core.index.get(character) ?? null;
  }
  const characters = Array.from(value.trim());
  if (characters.length === 1) return core.index.get(characters[0]) ?? null;
  return null;
}

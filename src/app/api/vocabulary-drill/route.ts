import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { nceeDatabasePath } from "@lib/database/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Mode = "phonetic" | "meaning" | "word";
interface WordRow { id: number; english: string; phonetic: string; chinese: string; phonetic_br: string; phonetic_us: string; meanings_json: string; examples_json: string }
const datasets = {
  ncee: nceeDatabasePath(),
} as const;
type Dataset = keyof typeof datasets;

function randomHintIndexes(word: string) {
  const letterCount = [...word].filter(character => /[a-z]/i.test(character)).length; const hintCount = letterCount <= 1 ? 0 : letterCount <= 6 ? 1 : 2;
  const indexes = Array.from({ length: letterCount }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index--) { const swap = Math.floor(Math.random() * (index + 1)); [indexes[index], indexes[swap]] = [indexes[swap], indexes[index]]; }
  return indexes.slice(0, hintCount).sort((a, b) => a - b);
}

function readDatabase<T>(dataset: Dataset, callback: (db: Database) => T) {
  const db = new Database(resolve(process.cwd(), datasets[dataset]), { readonly: true });
  try { return callback(db); } finally { db.close(); }
}

function wordsByIds(dataset: Dataset, mode: Mode, ids: number[]) {
  return readDatabase(dataset, (db) => {
    const condition = mode === "phonetic" ? "AND (phonetic_br <> '' OR phonetic_us <> '')" : "AND chinese <> ''";
    const placeholders = ids.map(() => "?").join(",");
    const rows = db.query<WordRow, number[]>(`SELECT id, english, phonetic, chinese, phonetic_br, phonetic_us, meanings_json, examples_json FROM words WHERE id IN (${placeholders}) ${condition}`).all(...ids);
    const byId = new Map(rows.map((word) => {
      const duplicates = mode === "meaning" ? db.query<{ english: string }, [string]>("SELECT english FROM words WHERE chinese = ? ORDER BY english").all(word.chinese) : [];
      const phonetics = [
        ...(word.phonetic_br ? [{ accent: "uk" as const, text: word.phonetic_br }] : []),
        ...(word.phonetic_us ? [{ accent: "us" as const, text: word.phonetic_us }] : []),
      ];
      return [word.id, {
        id: word.id, english: word.english, phonetic: word.phonetic, chinese: word.chinese,
        phonetics, meanings: JSON.parse(word.meanings_json), examples: JSON.parse(word.examples_json),
        hintIndexes: randomHintIndexes(word.english), duplicateCount: duplicates.length,
      }] as const;
    }));
    return ids.flatMap((id) => { const word = byId.get(id); return word ? [word] : []; });
  });
}

export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode") as Mode | null;
  const dataset = new URL(request.url).searchParams.get("dataset") as Dataset | null;
  if (!mode || !["phonetic", "meaning", "word"].includes(mode)) {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }
  if (!dataset || !(dataset in datasets)) return NextResponse.json({ error: "invalid_dataset" }, { status: 400 });
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("catalog") === "1") {
      const condition = mode === "phonetic" ? "phonetic_br <> '' OR phonetic_us <> ''" : "chinese <> ''";
      const ids = readDatabase(dataset, (db) => db.query<{ id: number }, []>(`SELECT id FROM words WHERE ${condition} ORDER BY id`).all().map((row) => row.id));
      return NextResponse.json({ ids });
    }
    const search = (url.searchParams.get("search") || "").trim();
    if (search) {
      const matches = readDatabase(dataset, (db) => db.query<{ id: number; english: string }, [string]>("SELECT id, english FROM words WHERE english LIKE ? COLLATE NOCASE ORDER BY english LIMIT 20").all(`%${search}%`));
      return NextResponse.json({ matches });
    }
    const ids = (url.searchParams.get("ids") || "").split(",").filter(Boolean).map(Number);
    if (!ids.length || ids.length > 20 || ids.some((id) => !Number.isInteger(id) || id < 1)) return NextResponse.json({ error: "invalid_ids" }, { status: 400 });
    const words = wordsByIds(dataset, mode, ids);
    return words.length ? NextResponse.json({ words }) : NextResponse.json({ error: "no_words" }, { status: 404 });
  } catch (error) {
    console.error("Unable to read NCEE vocabulary database", error);
    return NextResponse.json({ error: "database_unavailable" }, { status: 500 });
  }
}

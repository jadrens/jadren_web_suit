import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Mode = "phonetic" | "meaning" | "word";
interface WordRow { id: number; english: string; phonetic: string; chinese: string }
const datasets = { ncee: "database/NCEE.db" } as const;
type Dataset = keyof typeof datasets;

function readDatabase<T>(dataset: Dataset, callback: (db: Database) => T) {
  const db = new Database(resolve(process.cwd(), datasets[dataset]), { readonly: true });
  try { return callback(db); } finally { db.close(); }
}

function wordsByIds(dataset: Dataset, mode: Mode, ids: number[]) {
  return readDatabase(dataset, (db) => {
    const condition = mode === "phonetic" ? "AND phonetic <> ''" : "AND chinese <> ''";
    const placeholders = ids.map(() => "?").join(",");
    const rows = db.query<WordRow, number[]>(`SELECT id, english, phonetic, chinese FROM words WHERE id IN (${placeholders}) ${condition}`).all(...ids);
    const byId = new Map(rows.map((word) => {
      const duplicates = mode === "meaning" ? db.query<{ english: string }, [string]>("SELECT english FROM words WHERE chinese = ? ORDER BY english").all(word.chinese) : [];
      const letterCount = [...word.english].filter((character) => /[a-z]/i.test(character)).length;
      const hintLength = letterCount <= 5 ? 1 : 2;
      let seenLetters = 0; let hint = "";
      for (const character of word.english) { if (/[a-z]/i.test(character)) seenLetters++; hint += character; if (seenLetters >= hintLength) break; }
      return [word.id, { ...word, hint, duplicateCount: duplicates.length }] as const;
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
      const condition = mode === "phonetic" ? "phonetic <> ''" : "chinese <> ''";
      const ids = readDatabase(dataset, (db) => db.query<{ id: number }, []>(`SELECT id FROM words WHERE ${condition} ORDER BY id`).all().map((row) => row.id));
      return NextResponse.json({ ids });
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

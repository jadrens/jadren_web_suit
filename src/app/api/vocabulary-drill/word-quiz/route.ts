import { NextResponse } from "next/server";
import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import { lookupDictionaryEntry, normalizeDictionaryKey } from "@lib/dictionary/server";
import { nceeDatabasePath } from "@lib/database/paths";
import { db, requestVocabularyUser, vocabularyAuthFailure } from "@lib/vocabulary-practice/server";
import { dictionaryQuizSenses, hintsForSenseKeys, meaningsForSenseKeys } from "@lib/vocabulary-practice/word-quiz";
import { databaseJsonArray } from "@lib/vocabulary-practice/database-json";
import type { DrillMeaning } from "@lib/client-api/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface QuizRow {
  dataset: string;
  source_word_id: number;
  word: string;
  dictionary_lookup_key: string;
  sense_keys: string[] | string;
  meanings: DrillMeaning[] | string;
  created_at: Date | string;
}

function parameters(url: URL) {
  const dataset = (url.searchParams.get("dataset") || "").trim();
  const sourceWordId = Number(url.searchParams.get("sourceWordId"));
  if (dataset !== "ncee" || !Number.isInteger(sourceWordId) || sourceWordId < 1) return null;
  return { dataset, sourceWordId };
}

function meanings(value: DrillMeaning[] | string): DrillMeaning[] {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value) as DrillMeaning[]; } catch { return []; }
}

function quiz(row: QuizRow) {
  const savedMeanings = meanings(row.meanings);
  let hints = savedMeanings.map(() => "");
  try {
    const dictionary = lookupDictionaryEntry(row.dictionary_lookup_key);
    if (dictionary) hints = hintsForSenseKeys(dictionaryQuizSenses(dictionary.entry), databaseJsonArray<string>(row.sense_keys), savedMeanings);
  } catch { /* A cached quiz remains usable when dictionary clues are unavailable. */ }
  return {
    dataset: row.dataset,
    sourceWordId: Number(row.source_word_id),
    word: row.word,
    meanings: savedMeanings,
    hints,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function isAdministrator(userId: string) {
  const result = await db.query<{ is_admin: boolean }>(
    "SELECT is_admin FROM user_main WHERE user_id = $1 AND status = 1 LIMIT 1",
    [userId],
  );
  return result.rows[0]?.is_admin === true;
}

async function findQuiz(dataset: string, sourceWordId: number) {
  const result = await db.query<QuizRow>(
    `SELECT dataset, source_word_id, word, dictionary_lookup_key, sense_keys, meanings, created_at
       FROM vocabulary_word_quiz
      WHERE dataset = $1 AND source_word_id = $2
      LIMIT 1`,
    [dataset, sourceWordId],
  );
  return result.rows[0] || null;
}

function sourceWord(dataset: string, sourceWordId: number) {
  if (dataset !== "ncee") return null;
  const source = new Database(resolve(process.cwd(), nceeDatabasePath()), { readonly: true, strict: true });
  try {
    return source.query<{ english: string }, [number]>("SELECT english FROM words WHERE id = ? LIMIT 1").get(sourceWordId)?.english || null;
  } finally { source.close(); }
}

export async function GET(request: Request) {
  const input = parameters(new URL(request.url));
  if (!input) return NextResponse.json({ error: "invalid_quiz_key" }, { status: 400 });
  try {
    const user = await requestVocabularyUser(request);
    const [cached, canGenerate] = await Promise.all([
      findQuiz(input.dataset, input.sourceWordId),
      user?.status === 1 ? isAdministrator(user.sub) : Promise.resolve(false),
    ]);
    return NextResponse.json({ quiz: cached ? quiz(cached) : null, canGenerate }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const authFailure = vocabularyAuthFailure(error);
    if (authFailure) return authFailure;
    console.error("Unable to read cached vocabulary word quiz", error);
    return NextResponse.json({ error: "quiz_cache_unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requestVocabularyUser(request);
    if (!user) return NextResponse.json({ error: "token_required" }, { status: 401 });
    if (user.status !== 1 || !(await isAdministrator(user.sub))) return NextResponse.json({ error: "admin_required" }, { status: 403 });

    const body = await request.json() as Record<string, unknown>;
    const dataset = typeof body.dataset === "string" ? body.dataset.trim() : "";
    const sourceWordId = Number(body.sourceWordId);
    const word = typeof body.word === "string" ? body.word.trim() : "";
    const generatorModel = typeof body.generatorModel === "string" ? body.generatorModel.trim() : "";
    const senseKeys = Array.isArray(body.senseKeys)
      ? [...new Set(body.senseKeys.filter((key): key is string => typeof key === "string" && Boolean(key.trim())).map(key => key.trim()))]
      : [];
    if (dataset !== "ncee" || !Number.isInteger(sourceWordId) || sourceWordId < 1 || !word || word.length > 100 || !generatorModel || generatorModel.length > 255 || !senseKeys.length || senseKeys.length > 12) {
      return NextResponse.json({ error: "invalid_quiz" }, { status: 400 });
    }
    const expectedWord = sourceWord(dataset, sourceWordId);
    if (!expectedWord || normalizeDictionaryKey(expectedWord) !== normalizeDictionaryKey(word)) return NextResponse.json({ error: "source_word_mismatch" }, { status: 422 });

    const dictionary = lookupDictionaryEntry(expectedWord);
    if (!dictionary) return NextResponse.json({ error: "dictionary_entry_not_found" }, { status: 422 });
    const candidates = dictionaryQuizSenses(dictionary.entry);
    const selectedMeanings = meaningsForSenseKeys(candidates, senseKeys);
    if (selectedMeanings.length !== senseKeys.length) return NextResponse.json({ error: "invalid_dictionary_senses" }, { status: 422 });

    await db.query(
      `INSERT INTO vocabulary_word_quiz
         (dataset, source_word_id, word, dictionary_lookup_key, sense_keys, meanings, generator_model, created_by)
       VALUES ($1, $2, $3, $4, ($5::text)::jsonb, ($6::text)::jsonb, $7, $8)
       ON CONFLICT (dataset, source_word_id) DO NOTHING`,
      [dataset, sourceWordId, expectedWord, dictionary.resolvedKey, JSON.stringify(senseKeys), JSON.stringify(selectedMeanings), generatorModel, user.sub],
    );
    const saved = await findQuiz(dataset, sourceWordId);
    if (!saved) throw new Error("Quiz insert did not produce a cache row");
    return NextResponse.json({ quiz: quiz(saved), canGenerate: true }, { status: 201 });
  } catch (error) {
    const authFailure = vocabularyAuthFailure(error);
    if (authFailure) return authFailure;
    console.error("Unable to cache vocabulary word quiz", error);
    return NextResponse.json({ error: "quiz_cache_unavailable" }, { status: 500 });
  }
}

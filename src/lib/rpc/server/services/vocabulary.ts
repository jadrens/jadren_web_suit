import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { ServiceImpl } from "@connectrpc/connect";
import type { SentencePracticeService, VocabularyDrillService } from "@gen/jadren/v1/vocabulary_pb";
import { db, withTransaction } from "@lib/auth/db";
import { nceeDatabasePath } from "@lib/database/paths";
import { lookupDictionaryEntry, normalizeDictionaryKey } from "@lib/dictionary/server";
import { refreshCollectionOrders } from "@lib/vocabulary-practice/collection-order-server";
import { reviewItemKey } from "@lib/vocabulary-practice/collection-order";
import { validReviewEvents } from "@lib/vocabulary-practice/collection-reviews";
import type { ReviewEvent } from "@lib/vocabulary-practice/collection-memory";
import { saveCollectionStats } from "@lib/vocabulary-practice/collection-stats-server";
import { databaseJsonArray } from "@lib/vocabulary-practice/database-json";
import { formatVocabularyPhonetics, type DisplayPhonetic } from "@lib/vocabulary-practice/phonetics";
import { reviewSummary } from "@lib/vocabulary-practice/review-summary";
import {
  collectionMeanings,
  collectionSentencePractice,
  collectionUsage,
  collectionUsages,
  requestVocabularyUser,
  verifiedVocabularyUser,
  type CollectionUsageItemRow,
} from "@lib/vocabulary-practice/server";
import { dictionaryQuizSenses, hintsForSenseKeys, meaningsForSenseKeys } from "@lib/vocabulary-practice/word-quiz";
import type { DrillMeaning } from "@lib/client-api/types";
import { apiFailure, isUniqueViolation } from "../errors";
import { headersOf } from "../context";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Generated messages carry a "$typeName" marker; anything persisted as JSON is flattened first.
function plainMeanings(meanings: ReadonlyArray<{ text: string; partOfSpeech: string }>) {
  return meanings.map(({ text, partOfSpeech }) => ({ text, partOfSpeech }));
}

function plainPhonetics(phonetics: ReadonlyArray<{ accent: string; text: string; audio?: string }>) {
  return phonetics.map(({ accent, text, audio }) => ({ accent, text, ...(audio ? { audio } : {}) }));
}

// --- Sentence practice -----------------------------------------------------

const USAGE_ITEMS_SQL = `SELECT i.collection_id, i.dataset, i.source_word_id, i.word,
                CASE WHEN q.meanings IS NOT NULL AND jsonb_array_length(q.meanings) > 0 THEN q.meanings ELSE i.meanings END AS meanings,
                i.sentence_practice, i.created_at
           FROM vocabulary_collection_item i
           JOIN vocabulary_collection c USING (collection_id)
           LEFT JOIN vocabulary_word_quiz q ON q.dataset=i.dataset AND q.source_word_id=i.source_word_id AND q.quiz_version >= 2`;

interface StoredAttempt {
  attemptId: string;
  question: string;
  exampleSentence: string;
  answer: string;
  isCorrect: boolean;
  feedback: string;
  correctedSentence: string | null;
  createdAt: string;
}

function attemptMessage(attempt: StoredAttempt) {
  return { ...attempt, correctedSentence: attempt.correctedSentence ?? undefined };
}

function usageMessage(usage: ReturnType<typeof collectionUsage>) {
  return {
    ...usage,
    lastLearnTime: usage.lastLearnTime ?? undefined,
    attempts: (usage.attempts as StoredAttempt[]).map(attemptMessage),
  };
}

function shortText(value: string, max: number) {
  const text = value.trim();
  return text && text.length <= max ? text : null;
}

export const sentencePracticeService: ServiceImpl<typeof SentencePracticeService> = {
  async listUsages(_request, context) {
    const user = await verifiedVocabularyUser(headersOf(context));
    const [collections, items] = await Promise.all([
      db.query<{ collection_id: string; name: string }>(
        "SELECT collection_id, name FROM vocabulary_collection WHERE user_id = $1 ORDER BY created_at, name",
        [user.sub]
      ),
      db.query<CollectionUsageItemRow>(
        `${USAGE_ITEMS_SQL}
          WHERE c.user_id = $1
          ORDER BY i.word, i.created_at`,
        [user.sub]
      ),
    ]);
    return {
      collections: collections.rows.map((row) => ({ collectionId: row.collection_id, name: row.name })),
      usages: items.rows.flatMap(collectionUsages).map(usageMessage),
    };
  },

  async createUsage(request, context) {
    const user = await verifiedVocabularyUser(headersOf(context));
    const word = request.word.trim();
    const prompt = request.prompt.trim();
    const { collectionId } = request;
    if (!UUID_PATTERN.test(collectionId)) throw apiFailure("Collection is required", 400, "invalid_collection");
    if (!word || word.length > 100) throw apiFailure("Word must contain 1-100 characters", 400, "invalid_word");
    if (!prompt || prompt.length > 500) throw apiFailure("Usage must contain 1-500 characters", 400, "invalid_prompt");

    try {
      const saved = await withTransaction(async (client) => {
        const owned = await client.query("SELECT 1 FROM vocabulary_collection WHERE collection_id=$1 AND user_id=$2 FOR UPDATE", [collectionId, user.sub]);
        if (!owned.rows.length) return null;
        const existing = await client.query<CollectionUsageItemRow>(
          `SELECT collection_id,dataset,source_word_id,word,meanings,sentence_practice,created_at FROM vocabulary_collection_item WHERE collection_id=$1 AND lower(word)=lower($2) ORDER BY created_at LIMIT 1 FOR UPDATE`,
          [collectionId, word]
        );
        let row = existing.rows[0];
        if (row) {
          const meanings = collectionMeanings(row.meanings);
          if (meanings.some((meaning) => meaning.text.toLocaleLowerCase() === prompt.toLocaleLowerCase())) {
            return { duplicate: true as const };
          }
          const meaning = { text: prompt, partOfSpeech: "other" };
          await client.query(
            "UPDATE vocabulary_collection_item SET meanings=$4::jsonb WHERE collection_id=$1 AND dataset=$2 AND source_word_id=$3",
            [collectionId, row.dataset, row.source_word_id, JSON.stringify([...meanings, meaning])]
          );
          row = { ...row, meanings: [...meanings, meaning] };
          return { usage: collectionUsage(row, meaning) };
        }
        const next = await client.query<{ source_word_id: number }>(
          "SELECT COALESCE(MIN(source_word_id),0)-1 AS source_word_id FROM vocabulary_collection_item WHERE collection_id=$1 AND dataset='custom'",
          [collectionId]
        );
        const meaning = { text: prompt, partOfSpeech: "other" };
        const sourceWordId = Number(next.rows[0].source_word_id);
        const inserted = await client.query<CollectionUsageItemRow>(
          `INSERT INTO vocabulary_collection_item(collection_id,dataset,source_word_id,word,meanings) VALUES($1,'custom',$2,$3,$4::jsonb) RETURNING collection_id,dataset,source_word_id,word,meanings,sentence_practice,created_at`,
          [collectionId, sourceWordId, word, JSON.stringify([meaning])]
        );
        return { usage: collectionUsage(inserted.rows[0], meaning) };
      });
      if (!saved) throw apiFailure("Collection was not found", 404, "collection_not_found");
      if ("duplicate" in saved) throw apiFailure("This word usage already exists", 409, "usage_exists");
      return { usage: usageMessage(saved.usage) };
    } catch (error) {
      if (isUniqueViolation(error)) throw apiFailure("This word usage already exists", 409, "usage_exists");
      throw error;
    }
  },

  async deleteUsage(request, context) {
    const user = await verifiedVocabularyUser(headersOf(context));
    const { usageId } = request;
    const cleared = await withTransaction(async (client) => {
      const items = await client.query<CollectionUsageItemRow>(
        `${USAGE_ITEMS_SQL} WHERE c.user_id=$1 FOR UPDATE OF i`,
        [user.sub]
      );
      const item = items.rows.find((row) => collectionUsages(row).some((usage) => usage.usageId === usageId));
      if (!item) return false;
      const practice = collectionSentencePractice(item.sentence_practice);
      delete practice[usageId];
      await client.query(
        "UPDATE vocabulary_collection_item SET sentence_practice=$4::jsonb WHERE collection_id=$1 AND dataset=$2 AND source_word_id=$3",
        [item.collection_id, item.dataset, item.source_word_id, JSON.stringify(practice)]
      );
      return true;
    });
    if (!cleared) throw apiFailure("Vocabulary usage was not found", 404, "usage_not_found");
    return {};
  },

  async recordAttempt(request, context) {
    const user = await verifiedVocabularyUser(headersOf(context));
    const usageId = shortText(request.usageId, 100);
    const question = shortText(request.question, 2000);
    const exampleSentence = shortText(request.exampleSentence, 2000);
    const answer = shortText(request.answer, 5000);
    const feedback = shortText(request.feedback, 5000);
    const correctedSentence = request.correctedSentence === undefined || request.correctedSentence === ""
      ? null
      : shortText(request.correctedSentence, 5000);
    if (!usageId || !question || !exampleSentence || !answer || !feedback) {
      throw apiFailure("Invalid practice attempt", 400, "invalid_attempt");
    }
    const { isCorrect } = request;

    const saved = await withTransaction(async (client) => {
      const items = await client.query<CollectionUsageItemRow>(
        `${USAGE_ITEMS_SQL} WHERE c.user_id=$1 FOR UPDATE OF i`,
        [user.sub]
      );
      const item = items.rows.find((row) => collectionUsages(row).some((usage) => usage.usageId === usageId));
      if (!item) return null;
      const meaning = collectionMeanings(item.meanings).find((candidate) => collectionUsage(item, candidate).usageId === usageId)!;
      const current = collectionUsage(item, meaning);
      const practice = collectionSentencePractice(item.sentence_practice);
      const existing = practice[usageId];
      const recent = [...(Array.isArray(existing?.recentResults) ? existing.recentResults : []), isCorrect].slice(-8);
      const rate = `${recent.filter(Boolean).length}/${recent.length}`;
      const now = new Date().toISOString();
      const attempt: StoredAttempt = { attemptId: randomUUID(), question, exampleSentence, answer, isCorrect, feedback, correctedSentence, createdAt: now };
      practice[usageId] = {
        prompt: current.prompt, partOfSpeech: meaning.partOfSpeech,
        lastLearnTime: now, correct: Number(existing?.correct || 0) + (isCorrect ? 1 : 0),
        wrong: Number(existing?.wrong || 0) + (isCorrect ? 0 : 1), recentResults: recent,
        last8CorrectRate: rate, createdAt: existing?.createdAt || current.createdAt, updatedAt: now,
        attempts: [attempt, ...(Array.isArray(existing?.attempts) ? existing.attempts : [])].slice(0, 5),
      };
      await client.query(
        "UPDATE vocabulary_collection_item SET sentence_practice=$4::jsonb WHERE collection_id=$1 AND dataset=$2 AND source_word_id=$3",
        [item.collection_id, item.dataset, item.source_word_id, JSON.stringify(practice)]
      );
      return { attempt: attemptMessage(attempt), last8CorrectRate: rate };
    });
    if (!saved) throw apiFailure("Vocabulary usage was not found", 404, "usage_not_found");
    return saved;
  },
};

// --- Bundled word lists ----------------------------------------------------

type Mode = "phonetic" | "meaning" | "word";
interface WordRow { id: number; english: string; phonetic: string; chinese: string; phonetic_br: string; phonetic_us: string; meanings_json: string; examples_json: string }

const datasets = { ncee: nceeDatabasePath() } as const;
type Dataset = keyof typeof datasets;

function drillParameters(dataset: string, mode: string) {
  if (!["phonetic", "meaning", "word"].includes(mode)) throw apiFailure("invalid_mode", 400, "invalid_mode");
  if (!(dataset in datasets)) throw apiFailure("invalid_dataset", 400, "invalid_dataset");
  return { dataset: dataset as Dataset, mode: mode as Mode };
}

function randomHintIndexes(word: string) {
  const letterCount = [...word].filter((character) => /[a-z]/i.test(character)).length;
  const hintCount = letterCount <= 1 ? 0 : letterCount <= 6 ? 1 : 2;
  const indexes = Array.from({ length: letterCount }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[swap]] = [indexes[swap], indexes[index]];
  }
  return indexes.slice(0, hintCount).sort((a, b) => a - b);
}

function readDatabase<T>(dataset: Dataset, callback: (db: Database) => T) {
  const database = new Database(resolve(process.cwd(), datasets[dataset]), { readonly: true });
  try { return callback(database); } finally { database.close(); }
}

function jsonArray(value: string): Array<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
}

function wordsByIds(dataset: Dataset, mode: Mode, ids: number[]) {
  return readDatabase(dataset, (database) => {
    const condition = mode === "phonetic" ? "AND (phonetic_br <> '' OR phonetic_us <> '')" : "AND chinese <> ''";
    const placeholders = ids.map(() => "?").join(",");
    const rows = database.query<WordRow, number[]>(`SELECT id, english, phonetic, chinese, phonetic_br, phonetic_us, meanings_json, examples_json FROM words WHERE id IN (${placeholders}) ${condition}`).all(...ids);
    const byId = new Map(rows.map((word) => {
      const duplicates = mode === "meaning" ? database.query<{ english: string }, [string]>("SELECT english FROM words WHERE chinese = ? ORDER BY english").all(word.chinese) : [];
      const phonetics = [
        ...(word.phonetic_br ? [{ accent: "uk", text: word.phonetic_br }] : []),
        ...(word.phonetic_us ? [{ accent: "us", text: word.phonetic_us }] : []),
      ];
      return [word.id, {
        id: word.id, english: word.english, phonetic: word.phonetic, chinese: word.chinese,
        phonetics,
        meanings: jsonArray(word.meanings_json).map((meaning) => ({
          text: String(meaning.text ?? ""),
          partOfSpeech: String(meaning.partOfSpeech ?? "other"),
        })),
        examples: jsonArray(word.examples_json).map((example) => ({ en: String(example.en ?? ""), zh: String(example.zh ?? "") })),
        hintIndexes: randomHintIndexes(word.english), duplicateCount: duplicates.length,
      }] as const;
    }));
    return ids.flatMap((id) => { const word = byId.get(id); return word ? [word] : []; });
  });
}

// --- Online dictionary -----------------------------------------------------

interface OnlineDefinition { definition?: unknown; example?: unknown }
interface OnlineMeaning { partOfSpeech?: unknown; definitions?: OnlineDefinition[] }
interface OnlineEntry { phonetic?: unknown; phonetics?: Array<{ text?: unknown; audio?: unknown }>; meanings?: OnlineMeaning[] }

// --- Collections -----------------------------------------------------------

function meaningsFromDatabase(value: unknown) {
  let parsed = value;
  if (typeof parsed === "string") { try { parsed = JSON.parse(parsed); } catch { return []; } }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const text = String((item as { text?: unknown }).text || "").trim();
    const rawPart = String((item as { partOfSpeech?: unknown }).partOfSpeech || "other");
    return text ? [{ text, partOfSpeech: rawPart === "vti" ? "v" : rawPart }] : [];
  });
}

function arrayFromDatabase(value: unknown): unknown[] {
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return []; } }
  return Array.isArray(value) ? value : [];
}

function isoOrUndefined(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : undefined;
}

function reviewMessage(review: ReturnType<typeof reviewSummary>) {
  return {
    ...review,
    addedAt: review.addedAt ?? undefined,
    lastReviewedAt: review.lastReviewedAt ?? undefined,
    dueAt: review.dueAt ?? undefined,
    recallProbability: review.recallProbability ?? undefined,
    stabilityDays: review.stabilityDays ?? undefined,
    difficulty: review.difficulty ?? undefined,
    lapses: review.lapses ?? undefined,
  };
}

// --- Word quiz cache -------------------------------------------------------

interface QuizRow {
  dataset: string;
  source_word_id: number;
  word: string;
  exercise_kind: "meanings" | "dictionary";
  dictionary_lookup_key: string;
  sense_keys: string[] | string;
  meanings: DrillMeaning[] | string;
  quiz_version: number;
  created_at: Date | string;
}

const CURRENT_QUIZ_VERSION = 2;

function quizMeanings(value: DrillMeaning[] | string): DrillMeaning[] {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value) as DrillMeaning[]; } catch { return []; }
}

function quizMessage(row: QuizRow) {
  const savedMeanings = quizMeanings(row.meanings);
  let hints = savedMeanings.map(() => "");
  try {
    const dictionary = lookupDictionaryEntry(row.dictionary_lookup_key);
    if (dictionary) hints = hintsForSenseKeys(dictionaryQuizSenses(dictionary.entry), databaseJsonArray<string>(row.sense_keys), savedMeanings);
  } catch { /* A cached quiz remains usable when dictionary clues are unavailable. */ }
  return {
    dataset: row.dataset,
    sourceWordId: Number(row.source_word_id),
    word: row.word,
    exerciseKind: row.exercise_kind,
    meanings: savedMeanings,
    hints,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function isAdministrator(userId: string) {
  const result = await db.query<{ is_admin: boolean }>(
    "SELECT is_admin FROM user_main WHERE user_id = $1 AND status = 1 LIMIT 1",
    [userId]
  );
  return result.rows[0]?.is_admin === true;
}

async function findQuiz(dataset: string, sourceWordId: number) {
  const result = await db.query<QuizRow>(
    `SELECT dataset, source_word_id, word, exercise_kind, dictionary_lookup_key, sense_keys, meanings, quiz_version, created_at
       FROM vocabulary_word_quiz
      WHERE dataset = $1 AND source_word_id = $2
      LIMIT 1`,
    [dataset, sourceWordId]
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

export const vocabularyDrillService: ServiceImpl<typeof VocabularyDrillService> = {
  async listWordIds(request) {
    const { dataset, mode } = drillParameters(request.dataset, request.mode);
    const condition = mode === "phonetic" ? "phonetic_br <> '' OR phonetic_us <> ''" : "chinese <> ''";
    const ids = readDatabase(dataset, (database) => database.query<{ id: number }, []>(`SELECT id FROM words WHERE ${condition} ORDER BY id`).all().map((row) => row.id));
    return { ids };
  },

  async searchWords(request) {
    const { dataset } = drillParameters(request.dataset, request.mode);
    const search = request.query.trim();
    if (!search) return { matches: [] };
    const matches = readDatabase(dataset, (database) => database.query<{ id: number; english: string }, [string]>("SELECT id, english FROM words WHERE english LIKE ? COLLATE NOCASE ORDER BY english LIMIT 20").all(`%${search}%`));
    return { matches };
  },

  async getWords(request) {
    const { dataset, mode } = drillParameters(request.dataset, request.mode);
    const ids = request.ids;
    if (!ids.length || ids.length > 20 || ids.some((id) => id < 1)) throw apiFailure("invalid_ids", 400, "invalid_ids");
    const words = wordsByIds(dataset, mode, ids);
    if (!words.length) throw apiFailure("no_words", 404, "no_words");
    return { words };
  },

  async lookupOnlineWord(request) {
    const word = request.word.trim();
    if (!/^[a-zA-Z][a-zA-Z '-]{0,98}$/.test(word)) throw apiFailure("Invalid word", 400, "invalid_word");
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { headers: { accept: "application/json" }, next: { revalidate: 86400 } });
    if (response.status === 404) throw apiFailure("Word not found", 404, "word_not_found");
    if (!response.ok) throw new Error(`Dictionary API returned ${response.status}`);
    const entries = await response.json() as OnlineEntry[];
    const phonetics = entries.flatMap((entry) => entry.phonetics || []).flatMap((item) => {
      const text = String(item.text || "").trim();
      const audio = String(item.audio || "").trim();
      if (!text && !audio) return [];
      const accent = /[_-](us|us_|american)/i.test(audio) ? "us" : /[_-](gb|uk|gb_|british)/i.test(audio) ? "uk" : "other";
      return [{ accent, text, ...(audio ? { audio: audio.startsWith("//") ? `https:${audio}` : audio } : {}) }];
    }).filter((item, index, all) => {
      const matching = all.map((candidate, candidateIndex) => ({ candidate, candidateIndex })).filter(({ candidate }) => candidate.text === item.text && candidate.accent === item.accent);
      return index === (matching.find(({ candidate }) => candidate.audio)?.candidateIndex ?? matching[0].candidateIndex);
    });
    const definitions = entries.flatMap((entry) => entry.meanings || []).flatMap((meaning) => (meaning.definitions || []).map((definition) => ({
      partOfSpeech: String(meaning.partOfSpeech || "other"),
      definition: String(definition.definition || "").trim(),
      example: String(definition.example || "").trim(),
    }))).filter((item) => item.definition);
    return {
      phonetic: phonetics[0]?.text || String(entries[0]?.phonetic || ""),
      phonetics,
      definition: definitions[0]?.definition || "",
      example: definitions.find((item) => item.example)?.example || "",
      definitions,
    };
  },

  async getUserData(_request, context) {
    const user = await verifiedVocabularyUser(headersOf(context));
    await refreshCollectionOrders(user.sub);
    const [collections, items, progress] = await Promise.all([
      db.query<{ collection_id: string; name: string; practice_order: unknown; order_generated_at: Date | null }>("SELECT collection_id, name, practice_order, order_generated_at FROM vocabulary_collection WHERE user_id=$1 ORDER BY created_at", [user.sub]),
      db.query<{ collection_id: string; dataset: string; source_word_id: number; word: string; phonetic: string; phonetics: unknown; meanings: unknown; plural_forms: string; past_forms: string; example: string; definition: string; appearance_count: number; correct_count: number; wrong_count: number; created_at: Date; last_reviewed_at: Date | null; memory_card: unknown }>("SELECT i.collection_id,i.dataset,i.source_word_id,i.word,i.phonetic,i.phonetics,i.meanings,i.plural_forms,i.past_forms,i.example,i.definition,i.appearance_count,i.correct_count,i.wrong_count,i.created_at,i.last_reviewed_at,i.memory_card FROM vocabulary_collection_item i JOIN vocabulary_collection c USING(collection_id) WHERE c.user_id=$1 ORDER BY i.created_at ASC", [user.sub]),
      db.query<{ dataset: string; mode: string; word_order: number[]; current_index: number; order_generated_at: Date | null }>("SELECT dataset,mode,word_order,current_index,order_generated_at FROM vocabulary_drill_progress WHERE user_id=$1", [user.sub]),
    ]);
    const now = Date.now();
    context.responseHeader.set("Cache-Control", "private, no-store");
    return {
      collections: collections.rows.map((collection) => {
        const practiceOrder = databaseJsonArray<string>(collection.practice_order);
        const ranks = new Map(practiceOrder.map((key, index) => [key, index]));
        return {
          collectionId: collection.collection_id,
          name: collection.name,
          orderGeneratedAt: isoOrUndefined(collection.order_generated_at),
          practiceOrder,
          items: items.rows
            .filter((item) => item.collection_id === collection.collection_id)
            .sort((a, b) => (ranks.get(reviewItemKey(a)) ?? Number.MAX_SAFE_INTEGER) - (ranks.get(reviewItemKey(b)) ?? Number.MAX_SAFE_INTEGER))
            .map((item) => {
              const phonetics = arrayFromDatabase(item.phonetics) as DisplayPhonetic[];
              return {
                dataset: item.dataset,
                sourceWordId: Number(item.source_word_id),
                word: item.word,
                phonetic: formatVocabularyPhonetics(phonetics, item.phonetic),
                phonetics,
                meanings: meaningsFromDatabase(item.meanings),
                pluralForms: item.plural_forms,
                pastForms: item.past_forms,
                example: item.example,
                definition: item.definition,
                appearanceCount: Number(item.appearance_count),
                correctCount: Number(item.correct_count),
                wrongCount: Number(item.wrong_count),
                review: reviewMessage(reviewSummary(item, now)),
              };
            }),
        };
      }),
      progress: progress.rows.map((row) => ({
        dataset: row.dataset,
        mode: row.mode,
        order: row.word_order.map(Number),
        index: row.current_index,
        orderGeneratedAt: isoOrUndefined(row.order_generated_at),
      })),
    };
  },

  async saveProgress(request, context) {
    const user = await verifiedVocabularyUser(headersOf(context));
    if (!["phonetic", "meaning", "word"].includes(request.mode)) throw apiFailure("Invalid progress", 400, "invalid_progress");
    const orderGeneratedAt = request.orderGeneratedAt && Number.isFinite(Date.parse(request.orderGeneratedAt)) ? request.orderGeneratedAt : null;
    const postgresOrder = `{${request.order.join(",")}}`;
    await db.query(
      `INSERT INTO vocabulary_drill_progress(user_id,dataset,mode,word_order,current_index,order_generated_at) VALUES($1,$2,$3,$4::integer[],$5,$6)
       ON CONFLICT(user_id,dataset,mode) DO UPDATE SET word_order=EXCLUDED.word_order,current_index=EXCLUDED.current_index,order_generated_at=EXCLUDED.order_generated_at,updated_at=NOW()`,
      [user.sub, request.dataset || "ncee", request.mode, postgresOrder, request.index, orderGeneratedAt]
    );
    return { saved: true };
  },

  async createCollection(request, context) {
    const user = await verifiedVocabularyUser(headersOf(context));
    const name = request.name.trim();
    if (!name || name.length > 80) throw apiFailure("Invalid name", 400, "invalid_name");
    try {
      const row = await db.query<{ collection_id: string; name: string }>(
        "INSERT INTO vocabulary_collection(collection_id,user_id,name) VALUES($1,$2,$3) RETURNING collection_id,name",
        [randomUUID(), user.sub, name]
      );
      return { collection: { collectionId: row.rows[0].collection_id, name: row.rows[0].name, items: [] } };
    } catch (error) {
      if (isUniqueViolation(error)) throw apiFailure("Collection already exists", 409, "collection_exists");
      throw error;
    }
  },

  async deleteCollection(request, context) {
    const user = await verifiedVocabularyUser(headersOf(context));
    const { collectionId } = request;
    const deleted = await withTransaction(async (client) => {
      const result = await client.query<{ collection_id: string }>(
        "DELETE FROM vocabulary_collection WHERE collection_id=$1 AND user_id=$2 RETURNING collection_id",
        [collectionId, user.sub]
      );
      if (!result.rows.length) return false;
      await client.query("DELETE FROM vocabulary_drill_progress WHERE user_id=$1 AND dataset=$2", [user.sub, `collection:${collectionId}`]);
      return true;
    });
    if (!deleted) throw apiFailure("Collection not found", 404, "not_found");
    return {};
  },

  async reorderCollection(request, context) {
    const user = await verifiedVocabularyUser(headersOf(context));
    if (!UUID_PATTERN.test(request.collectionId)) throw apiFailure("Invalid collection", 400, "invalid_collection");
    if (!await refreshCollectionOrders(user.sub, request.collectionId)) throw apiFailure("Collection not found", 404, "not_found");
    return { saved: true };
  },

  async addItem(request, context) {
    const user = await verifiedVocabularyUser(headersOf(context));
    const { collectionId } = request;
    const requestedId = request.sourceWordId ?? null;
    const word = request.word.trim();
    const meanings = plainMeanings(request.meanings.filter((meaning) => meaning.text.trim()));
    if (!collectionId || !word || word.length > 100 || !meanings.length) throw apiFailure("Invalid item", 400, "invalid_item");
    const phonetics = plainPhonetics(request.phonetics);

    const item = await withTransaction(async (client) => {
      const owned = await client.query("SELECT 1 FROM vocabulary_collection WHERE collection_id=$1 AND user_id=$2 FOR UPDATE", [collectionId, user.sub]);
      if (!owned.rows.length) return null;
      const dataset = requestedId === null ? "custom" : request.dataset || "ncee";
      let sourceWordId = requestedId;
      if (sourceWordId === null) {
        const next = await client.query<{ source_word_id: number }>("SELECT COALESCE(MIN(source_word_id),0)-1 AS source_word_id FROM vocabulary_collection_item WHERE collection_id=$1 AND dataset='custom'", [collectionId]);
        sourceWordId = Number(next.rows[0].source_word_id);
      }
      const combinedPhonetic = formatVocabularyPhonetics(phonetics as DisplayPhonetic[], request.phonetic).slice(0, 160);
      const pluralForms = (request.pluralForms ?? "").slice(0, 240);
      const pastForms = (request.pastForms ?? "").slice(0, 240);
      const example = (request.example ?? "").slice(0, 4000);
      const definition = (request.definition ?? "").slice(0, 4000);
      await client.query(
        "INSERT INTO vocabulary_collection_item(collection_id,dataset,source_word_id,word,phonetic,phonetics,meanings,plural_forms,past_forms,example,definition) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11) ON CONFLICT DO NOTHING",
        [collectionId, dataset, sourceWordId, word, combinedPhonetic, JSON.stringify(phonetics), JSON.stringify(meanings), pluralForms, pastForms, example, definition]
      );
      return { dataset, sourceWordId, word, phonetic: combinedPhonetic, phonetics, meanings, pluralForms, pastForms, example, definition, appearanceCount: 0, correctCount: 0, wrongCount: 0 };
    });
    if (!item) throw apiFailure("Collection not found", 404, "not_found");
    return { saved: true, item };
  },

  async transferItem(request, context) {
    const user = await verifiedVocabularyUser(headersOf(context));
    const { collectionId, dataset, sourceWordId } = request;
    if (!collectionId || !dataset) throw apiFailure("Invalid item", 400, "invalid_item");
    const result = await withTransaction(async (client) => {
      const source = await client.query<{ name: string; transfer_origin_collection_id: string | null; transfer_origin_dataset: string | null; transfer_origin_source_word_id: number | null }>(
        `SELECT c.name,i.transfer_origin_collection_id,i.transfer_origin_dataset,i.transfer_origin_source_word_id FROM vocabulary_collection_item i JOIN vocabulary_collection c USING(collection_id)
          WHERE c.user_id=$1 AND i.collection_id=$2 AND i.dataset=$3 AND i.source_word_id=$4 FOR UPDATE`,
        [user.sub, collectionId, dataset, sourceWordId]
      );
      if (!source.rows.length) return null;
      const isRestore = source.rows[0].name.toLocaleLowerCase() === "transferred";
      let destinationCollectionId: string;
      let destinationDataset = dataset;
      let destinationSourceWordId = sourceWordId;
      if (isRestore) {
        destinationCollectionId = source.rows[0].transfer_origin_collection_id || "";
        destinationDataset = source.rows[0].transfer_origin_dataset || "";
        destinationSourceWordId = Number(source.rows[0].transfer_origin_source_word_id);
        if (!destinationCollectionId || !destinationDataset || !Number.isInteger(destinationSourceWordId)) throw new Error("transfer_origin_missing");
        const owned = await client.query("SELECT 1 FROM vocabulary_collection WHERE collection_id=$1 AND user_id=$2 FOR UPDATE", [destinationCollectionId, user.sub]);
        if (!owned.rows.length) throw new Error("transfer_origin_missing");
      } else {
        const existing = await client.query<{ collection_id: string }>("SELECT collection_id FROM vocabulary_collection WHERE user_id=$1 AND LOWER(name)='transferred' ORDER BY created_at LIMIT 1 FOR UPDATE", [user.sub]);
        if (existing.rows.length) destinationCollectionId = existing.rows[0].collection_id;
        else {
          destinationCollectionId = randomUUID();
          await client.query("INSERT INTO vocabulary_collection(collection_id,user_id,name) VALUES($1,$2,'transferred')", [destinationCollectionId, user.sub]);
        }
        const collision = await client.query("SELECT 1 FROM vocabulary_collection_item WHERE collection_id=$1 AND dataset=$2 AND source_word_id=$3", [destinationCollectionId, destinationDataset, destinationSourceWordId]);
        if (collision.rows.length) {
          const next = await client.query<{ source_word_id: number }>("SELECT COALESCE(MIN(source_word_id),0)-1 AS source_word_id FROM vocabulary_collection_item WHERE collection_id=$1 AND dataset=$2", [destinationCollectionId, destinationDataset]);
          destinationSourceWordId = Number(next.rows[0].source_word_id);
        }
      }
      const inserted = await client.query<{ source_word_id: number }>(
        `INSERT INTO vocabulary_collection_item(collection_id,dataset,source_word_id,word,phonetic,phonetics,meanings,plural_forms,past_forms,example,definition,transfer_origin_collection_id,transfer_origin_dataset,transfer_origin_source_word_id,appearance_count,correct_count,wrong_count,last_reviewed_at,memory_card,review_seed,review_history)
          SELECT $4,$5,$6,word,phonetic,phonetics,meanings,plural_forms,past_forms,example,definition,$7,$8,$9,appearance_count,correct_count,wrong_count,last_reviewed_at,memory_card,review_seed,review_history FROM vocabulary_collection_item
          WHERE collection_id=$1 AND dataset=$2 AND source_word_id=$3 ON CONFLICT DO NOTHING RETURNING source_word_id`,
        [collectionId, dataset, sourceWordId, destinationCollectionId, destinationDataset, destinationSourceWordId, isRestore ? null : collectionId, isRestore ? null : dataset, isRestore ? null : sourceWordId]
      );
      if (!inserted.rows.length) throw new Error("transfer_destination_duplicate");
      await client.query("DELETE FROM vocabulary_collection_item WHERE collection_id=$1 AND dataset=$2 AND source_word_id=$3", [collectionId, dataset, sourceWordId]);
      return { restored: isRestore, destinationCollectionId };
    });
    if (!result) throw apiFailure("Collection item not found", 404, "not_found");
    return result;
  },

  async deleteItem(request, context) {
    const user = await verifiedVocabularyUser(headersOf(context));
    if (!request.collectionId) throw apiFailure("Invalid item", 400, "invalid_item");
    const result = await db.query<{ source_word_id: number }>(
      `DELETE FROM vocabulary_collection_item i USING vocabulary_collection c
        WHERE i.collection_id=c.collection_id AND c.user_id=$1 AND i.collection_id=$2 AND i.source_word_id=$3 AND ($4::text IS NULL OR i.dataset=$4) RETURNING i.source_word_id`,
      [user.sub, request.collectionId, request.sourceWordId, request.dataset ?? null]
    );
    if (!result.rows.length) throw apiFailure("Collection item not found", 404, "not_found");
    return {};
  },

  async saveStatDeltas(request, context) {
    const user = await verifiedVocabularyUser(headersOf(context));
    if (request.deltas.length > 500) throw apiFailure("Invalid stat deltas", 400, "invalid_stat_deltas");
    const deltas = request.deltas.map((delta) => ({
      collectionId: delta.collectionId,
      dataset: delta.dataset,
      sourceWordId: delta.sourceWordId,
      reviews: delta.reviews.map(({ id, reviewedAt, rating }) => ({ id, reviewedAt, rating })) as ReviewEvent[],
      lastReviewedAt: delta.lastReviewedAt && Number.isFinite(Date.parse(delta.lastReviewedAt))
        ? new Date(Math.min(Date.now(), Date.parse(delta.lastReviewedAt))).toISOString()
        : null,
      appearances: delta.appearances,
      correct: delta.correct,
      wrong: delta.wrong,
    }));
    if (deltas.some((item) => !validReviewEvents(item.reviews) || !item.collectionId || !item.dataset ||
        ![item.appearances, item.correct, item.wrong].every((value) => Number.isInteger(value) && value >= 0 && value <= 10000))) {
      throw apiFailure("Invalid stat deltas", 400, "invalid_stat_deltas");
    }
    await saveCollectionStats(user.sub, deltas);
    return { saved: true };
  },

  async getWordQuiz(request, context) {
    const dataset = request.dataset.trim();
    const sourceWordId = request.sourceWordId;
    if (dataset !== "ncee" || sourceWordId < 1) throw apiFailure("invalid_quiz_key", 400, "invalid_quiz_key");
    const user = await requestVocabularyUser(headersOf(context));
    let cached: QuizRow | null;
    let canGenerate: boolean;
    try {
      [cached, canGenerate] = await Promise.all([
        findQuiz(dataset, sourceWordId),
        user?.status === 1 ? isAdministrator(user.sub) : Promise.resolve(false),
      ]);
    } catch (error) {
      console.error("Unable to read cached vocabulary word quiz", error);
      throw apiFailure("quiz_cache_unavailable", 500, "quiz_cache_unavailable");
    }
    context.responseHeader.set("Cache-Control", "private, no-store");
    return { quiz: cached && Number(cached.quiz_version) >= CURRENT_QUIZ_VERSION ? quizMessage(cached) : undefined, canGenerate };
  },

  async cacheWordQuiz(request, context) {
    const user = await requestVocabularyUser(headersOf(context));
    if (!user) throw apiFailure("token_required", 401, "token_required");
    if (user.status !== 1 || !(await isAdministrator(user.sub))) throw apiFailure("admin_required", 403, "admin_required");

    const dataset = request.dataset.trim();
    const sourceWordId = request.sourceWordId;
    const word = request.word.trim();
    const generatorModel = request.generatorModel.trim();
    const exerciseKind = request.exerciseKind === "dictionary" ? "dictionary" : request.exerciseKind === "meanings" ? "meanings" : "";
    const senseKeys = [...new Set(request.senseKeys.filter((key) => key.trim()).map((key) => key.trim()))];
    if (dataset !== "ncee" || sourceWordId < 1 || !word || word.length > 100 || !generatorModel || generatorModel.length > 255 || !exerciseKind || (exerciseKind === "meanings" ? !senseKeys.length || senseKeys.length > 4 : senseKeys.length > 0)) {
      throw apiFailure("invalid_quiz", 400, "invalid_quiz");
    }
    const expectedWord = sourceWord(dataset, sourceWordId);
    if (!expectedWord || normalizeDictionaryKey(expectedWord) !== normalizeDictionaryKey(word)) throw apiFailure("source_word_mismatch", 422, "source_word_mismatch");

    const dictionary = lookupDictionaryEntry(expectedWord);
    if (!dictionary) throw apiFailure("dictionary_entry_not_found", 422, "dictionary_entry_not_found");
    const candidates = dictionaryQuizSenses(dictionary.entry);
    const selectedMeanings = meaningsForSenseKeys(candidates, senseKeys);
    if (selectedMeanings.length !== senseKeys.length) throw apiFailure("invalid_dictionary_senses", 422, "invalid_dictionary_senses");

    try {
      await db.query(
        `INSERT INTO vocabulary_word_quiz
           (dataset, source_word_id, word, exercise_kind, dictionary_lookup_key, sense_keys, meanings, quiz_version, generator_model, created_by)
         VALUES ($1, $2, $3, $4, $5, ($6::text)::jsonb, ($7::text)::jsonb, $8, $9, $10)
         ON CONFLICT (dataset, source_word_id) DO UPDATE
           SET word=EXCLUDED.word, exercise_kind=EXCLUDED.exercise_kind, dictionary_lookup_key=EXCLUDED.dictionary_lookup_key,
               sense_keys=EXCLUDED.sense_keys, meanings=EXCLUDED.meanings, quiz_version=EXCLUDED.quiz_version,
               generator_model=EXCLUDED.generator_model, created_by=EXCLUDED.created_by, created_at=NOW()
         WHERE vocabulary_word_quiz.quiz_version < EXCLUDED.quiz_version`,
        [dataset, sourceWordId, expectedWord, exerciseKind, dictionary.resolvedKey, JSON.stringify(senseKeys), JSON.stringify(selectedMeanings), CURRENT_QUIZ_VERSION, generatorModel, user.sub]
      );
      const saved = await findQuiz(dataset, sourceWordId);
      if (!saved) throw new Error("Quiz insert did not produce a cache row");
      return { quiz: quizMessage(saved), canGenerate: true };
    } catch (error) {
      console.error("Unable to cache vocabulary word quiz", error);
      throw apiFailure("quiz_cache_unavailable", 500, "quiz_cache_unavailable");
    }
  },
};

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, internalError, isUniqueViolation } from "@lib/auth/http";
import {
  db,
  requestVocabularyUser,
  requireVocabularyUser,
  toUsage,
  vocabularyAuthFailure,
  type VocabularyAttemptRow,
  type VocabularyUsageRow,
} from "@lib/vocabulary-practice/server";

export async function GET(request: Request) {
  try {
    const user = await requestVocabularyUser(request);
    const authError = requireVocabularyUser(user);
    if (authError) return authError;
    const [collections, usages, attempts] = await Promise.all([
      db.query<{ collection_id: string; name: string }>(
        "SELECT collection_id, name FROM vocabulary_collection WHERE user_id = $1 ORDER BY created_at, name",
        [user!.sub]
      ),
      db.query<VocabularyUsageRow>(
        `SELECT usage_id, collection_id, word, usage_prompt, last_learn_time, correct_count,
                wrong_count, last_8_correct_rate, created_at, updated_at
           FROM vocabulary_usage WHERE user_id = $1
          ORDER BY word, usage_prompt`,
        [user!.sub]
      ),
      db.query<VocabularyAttemptRow>(
        `SELECT attempt_id, usage_id, question, example_sentence, answer,
                is_correct, feedback, corrected_sentence, created_at
           FROM vocabulary_practice_attempt WHERE user_id = $1
          ORDER BY created_at DESC`,
        [user!.sub]
      ),
    ]);
    const byUsage = new Map<string, VocabularyAttemptRow[]>();
    for (const attempt of attempts.rows) byUsage.set(attempt.usage_id, [...(byUsage.get(attempt.usage_id) || []), attempt]);
    return NextResponse.json({
      collections: collections.rows.map((row) => ({ collectionId: row.collection_id, name: row.name })),
      usages: usages.rows.map((row) => toUsage(row, byUsage.get(row.usage_id))),
    });
  } catch (error) {
    return vocabularyAuthFailure(error) ?? internalError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requestVocabularyUser(request);
    const authError = requireVocabularyUser(user);
    if (authError) return authError;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return apiError("Invalid JSON body", 400, "invalid_json");
    const word = typeof body.word === "string" ? body.word.trim() : "";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const collectionId = typeof body.collectionId === "string" ? body.collectionId : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collectionId)) return apiError("Collection is required", 400, "invalid_collection");
    if (!word || word.length > 100) return apiError("Word must contain 1-100 characters", 400, "invalid_word");
    if (!prompt || prompt.length > 500) return apiError("Usage must contain 1-500 characters", 400, "invalid_prompt");
    const result = await db.query<VocabularyUsageRow>(
      `INSERT INTO vocabulary_usage (usage_id, user_id, collection_id, word, usage_prompt)
       SELECT $1, $2, collection_id, $4, $5
       FROM vocabulary_collection WHERE collection_id = $3 AND user_id = $2
       RETURNING usage_id, collection_id, word, usage_prompt, last_learn_time, correct_count,
                 wrong_count, last_8_correct_rate, created_at, updated_at`,
      [randomUUID(), user!.sub, collectionId, word, prompt]
    );
    if (!result.rows[0]) return apiError("Collection was not found", 404, "collection_not_found");
    return NextResponse.json({ usage: toUsage(result.rows[0]) }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return apiError("This word usage already exists", 409, "usage_exists");
    return vocabularyAuthFailure(error) ?? internalError(error);
  }
}

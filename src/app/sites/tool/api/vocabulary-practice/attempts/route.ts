import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, internalError } from "@shared/libs/auth/http";
import { withTransaction } from "@shared/libs/auth/db";
import { requestVocabularyUser, requireVocabularyUser, toAttempt, vocabularyAuthFailure, type VocabularyAttemptRow } from "@shared/libs/vocabulary-practice/server";

function shortText(value: unknown, max: number) {
  return typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
}

export async function POST(request: Request) {
  try {
    const user = await requestVocabularyUser(request);
    const authError = requireVocabularyUser(user);
    if (authError) return authError;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return apiError("Invalid JSON body", 400, "invalid_json");
    const usageId = shortText(body.usageId, 100);
    const question = shortText(body.question, 2000);
    const exampleSentence = shortText(body.exampleSentence, 2000);
    const answer = shortText(body.answer, 5000);
    const feedback = shortText(body.feedback, 5000);
    const correctedSentence = body.correctedSentence === null || body.correctedSentence === "" ? null : shortText(body.correctedSentence, 5000);
    if (!usageId || !question || !exampleSentence || !answer || !feedback || typeof body.isCorrect !== "boolean" || correctedSentence === undefined) {
      return apiError("Invalid practice attempt", 400, "invalid_attempt");
    }
    const attempt = await withTransaction(async (client) => {
      const usage = await client.query<{ recent_results: boolean[] }>(
        "SELECT recent_results FROM vocabulary_usage WHERE usage_id = $1 AND user_id = $2 FOR UPDATE",
        [usageId, user!.sub]
      );
      if (!usage.rows[0]) return null;
      const recent = [...(usage.rows[0].recent_results || []), body.isCorrect as boolean].slice(-8);
      const rate = `${recent.filter(Boolean).length}/${recent.length}`;
      await client.query(
        `UPDATE vocabulary_usage
            SET last_learn_time = NOW(),
                correct_count = correct_count + $3,
                wrong_count = wrong_count + $4,
                recent_results = CASE
                  WHEN cardinality(recent_results) >= 8
                    THEN array_append(recent_results[2:8], $5::boolean)
                  ELSE array_append(recent_results, $5::boolean)
                END,
                last_8_correct_rate = $6,
                updated_at = NOW()
          WHERE usage_id = $1 AND user_id = $2`,
        [usageId, user!.sub, body.isCorrect ? 1 : 0, body.isCorrect ? 0 : 1, body.isCorrect, rate]
      );
      const inserted = await client.query<VocabularyAttemptRow>(
        `INSERT INTO vocabulary_practice_attempt
          (attempt_id, usage_id, user_id, question, example_sentence, answer,
           is_correct, feedback, corrected_sentence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING attempt_id, usage_id, question, example_sentence, answer,
                   is_correct, feedback, corrected_sentence, created_at`,
        [randomUUID(), usageId, user!.sub, question, exampleSentence, answer, body.isCorrect, feedback, correctedSentence]
      );
      await client.query(
        `DELETE FROM vocabulary_practice_attempt
          WHERE attempt_id IN (
            SELECT attempt_id FROM vocabulary_practice_attempt
             WHERE usage_id = $1 AND user_id = $2
             ORDER BY created_at DESC, attempt_id DESC OFFSET 5
          )`,
        [usageId, user!.sub]
      );
      return { attempt: toAttempt(inserted.rows[0]), last8CorrectRate: rate };
    });
    if (!attempt) return apiError("Vocabulary usage was not found", 404, "usage_not_found");
    return NextResponse.json(attempt, { status: 201 });
  } catch (error) {
    return vocabularyAuthFailure(error) ?? internalError(error);
  }
}

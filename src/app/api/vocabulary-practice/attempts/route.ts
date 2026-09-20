import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, internalError } from "@lib/auth/http";
import { withTransaction } from "@lib/auth/db";
import { collectionMeanings, collectionSentencePractice, collectionUsage, collectionUsages, requestVocabularyUser, requireVocabularyUser, vocabularyAuthFailure, type CollectionUsageItemRow } from "@lib/vocabulary-practice/server";

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
    const saved = await withTransaction(async (client) => {
      const items = await client.query<CollectionUsageItemRow>(
        `SELECT i.collection_id,i.dataset,i.source_word_id,i.word,
                CASE WHEN q.meanings IS NOT NULL AND jsonb_array_length(q.meanings)>0 THEN q.meanings ELSE i.meanings END AS meanings,
                i.sentence_practice,i.created_at
           FROM vocabulary_collection_item i JOIN vocabulary_collection c USING(collection_id)
           LEFT JOIN vocabulary_word_quiz q ON q.dataset=i.dataset AND q.source_word_id=i.source_word_id AND q.quiz_version >= 2
          WHERE c.user_id=$1 FOR UPDATE OF i`, [user!.sub]);
      const item = items.rows.find(row => collectionUsages(row).some(usage => usage.usageId === usageId));
      if (!item) return null;
      const meaning = collectionMeanings(item.meanings).find(candidate => collectionUsage(item, candidate).usageId === usageId)!;
      const current = collectionUsage(item, meaning);
      const practice = collectionSentencePractice(item.sentence_practice);
      const existing = practice[usageId];
      const recent = [...(Array.isArray(existing?.recentResults) ? existing.recentResults : []), body.isCorrect as boolean].slice(-8);
      const rate = `${recent.filter(Boolean).length}/${recent.length}`;
      const now = new Date().toISOString();
      const attempt = { attemptId: randomUUID(), question, exampleSentence, answer, isCorrect: body.isCorrect as boolean, feedback, correctedSentence, createdAt: now };
      practice[usageId] = {
        prompt: current.prompt, partOfSpeech: meaning.partOfSpeech,
        lastLearnTime: now, correct: Number(existing?.correct || 0) + (body.isCorrect ? 1 : 0),
        wrong: Number(existing?.wrong || 0) + (body.isCorrect ? 0 : 1), recentResults: recent,
        last8CorrectRate: rate, createdAt: existing?.createdAt || current.createdAt, updatedAt: now,
        attempts: [attempt, ...(Array.isArray(existing?.attempts) ? existing.attempts : [])].slice(0, 5),
      };
      await client.query("UPDATE vocabulary_collection_item SET sentence_practice=$4::jsonb WHERE collection_id=$1 AND dataset=$2 AND source_word_id=$3", [item.collection_id, item.dataset, item.source_word_id, JSON.stringify(practice)]);
      return { attempt, last8CorrectRate: rate };
    });
    if (!saved) return apiError("Vocabulary usage was not found", 404, "usage_not_found");
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return vocabularyAuthFailure(error) ?? internalError(error);
  }
}

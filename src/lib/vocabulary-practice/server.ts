import { apiError, internalError } from "@lib/auth/http";
import { db } from "@lib/auth/db";
import { bearerToken, verifyAccessToken } from "@lib/auth/jwt";
import { createHash } from "node:crypto";

export class InvalidVocabularyAccessTokenError extends Error {}

export async function requestVocabularyUser(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    return await verifyAccessToken(token);
  } catch (error) {
    if (error instanceof Error && error.message.includes("JWT_SECRET")) throw error;
    throw new InvalidVocabularyAccessTokenError();
  }
}

export function requireVocabularyUser(user: Awaited<ReturnType<typeof requestVocabularyUser>>) {
  if (!user) return apiError("Bearer token is required", 401, "token_required");
  if (user.status === 2) return apiError("Account is unavailable", 403, "account_unavailable");
  if (user.status !== 1) return apiError("Verify your email before practicing vocabulary", 403, "email_unverified");
  return null;
}

export function vocabularyAuthFailure(error: unknown) {
  if (error instanceof Error && error.message.includes("JWT_SECRET")) return internalError(error);
  if (error instanceof InvalidVocabularyAccessTokenError) return apiError("Token is invalid or expired", 401, "invalid_token");
  return null;
}

export interface VocabularyUsageRow {
  usage_id: string;
  collection_id: string;
  word: string;
  usage_prompt: string;
  last_learn_time: string | Date | null;
  correct_count: number;
  wrong_count: number;
  last_8_correct_rate: string;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface VocabularyAttemptRow {
  attempt_id: string;
  usage_id: string;
  question: string;
  example_sentence: string;
  answer: string;
  is_correct: boolean;
  feedback: string;
  corrected_sentence: string | null;
  created_at: string | Date;
}

export interface CollectionUsageItemRow {
  collection_id: string;
  dataset: string;
  source_word_id: number;
  word: string;
  meanings: unknown;
  sentence_practice: unknown;
  created_at: string | Date;
}

interface CollectionMeaning { text: string; partOfSpeech: string }
interface StoredSentenceUsage {
  prompt: string;
  partOfSpeech: string;
  lastLearnTime: string | null;
  correct: number;
  wrong: number;
  recentResults: boolean[];
  last8CorrectRate: string;
  createdAt: string;
  updatedAt: string;
  attempts: ReturnType<typeof toAttempt>[];
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return {}; } }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function collectionMeanings(value: unknown): CollectionMeaning[] {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return []; } }
  if (!Array.isArray(value)) return [];
  return value.flatMap(raw => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>; const text = String(item.text || "").trim();
    return text ? [{ text, partOfSpeech: String(item.partOfSpeech || "other") }] : [];
  });
}

export function collectionUsageId(row: Pick<CollectionUsageItemRow, "collection_id" | "dataset" | "source_word_id">, meaning: CollectionMeaning) {
  const hex = createHash("sha256").update(JSON.stringify([row.collection_id, row.dataset, Number(row.source_word_id), meaning.partOfSpeech, meaning.text])).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function collectionSentencePractice(value: unknown): Record<string, StoredSentenceUsage> {
  return jsonObject(value) as Record<string, StoredSentenceUsage>;
}

export function collectionUsage(row: CollectionUsageItemRow, meaning: CollectionMeaning) {
  const practice = collectionSentencePractice(row.sentence_practice);
  const fallbackId = collectionUsageId(row, meaning);
  const storedEntry = Object.entries(practice).find(([id, value]) => id === fallbackId || (value?.prompt === meaning.text && value?.partOfSpeech === meaning.partOfSpeech));
  const usageId = storedEntry?.[0] || fallbackId; const stored = storedEntry?.[1]; const createdAt = new Date(stored?.createdAt || row.created_at).toISOString();
  return {
    usageId, collectionId: row.collection_id, word: row.word, prompt: meaning.text,
    lastLearnTime: stored?.lastLearnTime || null, correct: Number(stored?.correct || 0), wrong: Number(stored?.wrong || 0),
    last8CorrectRate: stored?.last8CorrectRate || "0/0", createdAt,
    updatedAt: new Date(stored?.updatedAt || createdAt).toISOString(), attempts: Array.isArray(stored?.attempts) ? stored.attempts : [],
  };
}

export function collectionUsages(row: CollectionUsageItemRow) {
  return collectionMeanings(row.meanings).map(meaning => collectionUsage(row, meaning));
}

export function toAttempt(row: VocabularyAttemptRow) {
  return {
    attemptId: row.attempt_id,
    question: row.question,
    exampleSentence: row.example_sentence,
    answer: row.answer,
    isCorrect: row.is_correct,
    feedback: row.feedback,
    correctedSentence: row.corrected_sentence,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function toUsage(row: VocabularyUsageRow, attempts: VocabularyAttemptRow[] = []) {
  return {
    usageId: row.usage_id,
    collectionId: row.collection_id,
    word: row.word,
    prompt: row.usage_prompt,
    lastLearnTime: row.last_learn_time ? new Date(row.last_learn_time).toISOString() : null,
    correct: row.correct_count,
    wrong: row.wrong_count,
    last8CorrectRate: row.last_8_correct_rate,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    attempts: attempts.map(toAttempt),
  };
}

export { db };

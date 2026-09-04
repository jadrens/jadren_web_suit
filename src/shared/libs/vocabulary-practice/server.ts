import { apiError, internalError } from "@shared/libs/auth/http";
import { db } from "@shared/libs/auth/db";
import { bearerToken, verifyAccessToken } from "@shared/libs/auth/jwt";

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

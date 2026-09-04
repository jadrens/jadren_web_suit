import { NextResponse } from "next/server";
import { apiError, internalError } from "@shared/libs/auth/http";
import { db, requestVocabularyUser, requireVocabularyUser, vocabularyAuthFailure } from "@shared/libs/vocabulary-practice/server";

export async function DELETE(request: Request, context: { params: Promise<{ usageId: string }> }) {
  try {
    const user = await requestVocabularyUser(request);
    const authError = requireVocabularyUser(user);
    if (authError) return authError;
    const { usageId } = await context.params;
    const result = await db.query<{ usage_id: string }>(
      "DELETE FROM vocabulary_usage WHERE usage_id = $1 AND user_id = $2 RETURNING usage_id",
      [usageId, user!.sub]
    );
    if (!result.rows[0]) return apiError("Vocabulary usage was not found", 404, "usage_not_found");
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return vocabularyAuthFailure(error) ?? internalError(error);
  }
}

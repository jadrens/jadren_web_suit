import { NextResponse } from "next/server";
import { apiError, internalError } from "@lib/auth/http";
import { withTransaction } from "@lib/auth/db";
import { collectionSentencePractice, collectionUsages, requestVocabularyUser, requireVocabularyUser, vocabularyAuthFailure, type CollectionUsageItemRow } from "@lib/vocabulary-practice/server";

export async function DELETE(request: Request, context: { params: Promise<{ usageId: string }> }) {
  try {
    const user = await requestVocabularyUser(request);
    const authError = requireVocabularyUser(user);
    if (authError) return authError;
    const { usageId } = await context.params;
    const cleared = await withTransaction(async client => {
      const items = await client.query<CollectionUsageItemRow>(`SELECT i.collection_id,i.dataset,i.source_word_id,i.word,CASE WHEN q.meanings IS NOT NULL AND jsonb_array_length(q.meanings)>0 THEN q.meanings ELSE i.meanings END AS meanings,i.sentence_practice,i.created_at FROM vocabulary_collection_item i JOIN vocabulary_collection c USING(collection_id) LEFT JOIN vocabulary_word_quiz q ON q.dataset=i.dataset AND q.source_word_id=i.source_word_id AND q.quiz_version >= 2 WHERE c.user_id=$1 FOR UPDATE OF i`, [user!.sub]);
      const item = items.rows.find(row => collectionUsages(row).some(usage => usage.usageId === usageId));
      if (!item) return false;
      const practice = collectionSentencePractice(item.sentence_practice); delete practice[usageId];
      await client.query("UPDATE vocabulary_collection_item SET sentence_practice=$4::jsonb WHERE collection_id=$1 AND dataset=$2 AND source_word_id=$3", [item.collection_id, item.dataset, item.source_word_id, JSON.stringify(practice)]);
      return true;
    });
    if (!cleared) return apiError("Vocabulary usage was not found", 404, "usage_not_found");
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return vocabularyAuthFailure(error) ?? internalError(error);
  }
}

import { NextResponse } from "next/server";
import { apiError, internalError, isUniqueViolation } from "@lib/auth/http";
import { withTransaction } from "@lib/auth/db";
import {
  collectionMeanings,
  collectionUsage,
  collectionUsages,
  db,
  requestVocabularyUser,
  requireVocabularyUser,
  vocabularyAuthFailure,
  type CollectionUsageItemRow,
} from "@lib/vocabulary-practice/server";

export async function GET(request: Request) {
  try {
    const user = await requestVocabularyUser(request);
    const authError = requireVocabularyUser(user);
    if (authError) return authError;
    const [collections, items] = await Promise.all([
      db.query<{ collection_id: string; name: string }>(
        "SELECT collection_id, name FROM vocabulary_collection WHERE user_id = $1 ORDER BY created_at, name",
        [user!.sub]
      ),
      db.query<CollectionUsageItemRow>(
        `SELECT i.collection_id, i.dataset, i.source_word_id, i.word,
                CASE WHEN q.meanings IS NOT NULL AND jsonb_array_length(q.meanings) > 0 THEN q.meanings ELSE i.meanings END AS meanings,
                i.sentence_practice, i.created_at
           FROM vocabulary_collection_item i
           JOIN vocabulary_collection c USING (collection_id)
           LEFT JOIN vocabulary_word_quiz q ON q.dataset=i.dataset AND q.source_word_id=i.source_word_id AND q.quiz_version >= 2
          WHERE c.user_id = $1
          ORDER BY i.word, i.created_at`, [user!.sub]),
    ]);
    return NextResponse.json({
      collections: collections.rows.map((row) => ({ collectionId: row.collection_id, name: row.name })),
      usages: items.rows.flatMap(collectionUsages),
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
    const saved = await withTransaction(async client => {
      const owned = await client.query("SELECT 1 FROM vocabulary_collection WHERE collection_id=$1 AND user_id=$2 FOR UPDATE", [collectionId, user!.sub]);
      if (!owned.rows.length) return null;
      const existing = await client.query<CollectionUsageItemRow>(`SELECT collection_id,dataset,source_word_id,word,meanings,sentence_practice,created_at FROM vocabulary_collection_item WHERE collection_id=$1 AND lower(word)=lower($2) ORDER BY created_at LIMIT 1 FOR UPDATE`, [collectionId, word]);
      let row = existing.rows[0];
      if (row) {
        const meanings = collectionMeanings(row.meanings);
        if (meanings.some(meaning => meaning.text.toLocaleLowerCase() === prompt.toLocaleLowerCase())) return { duplicate: true as const };
        const meaning = { text: prompt, partOfSpeech: "other" };
        await client.query("UPDATE vocabulary_collection_item SET meanings=$4::jsonb WHERE collection_id=$1 AND dataset=$2 AND source_word_id=$3", [collectionId, row.dataset, row.source_word_id, JSON.stringify([...meanings, meaning])]);
        row = { ...row, meanings: [...meanings, meaning] };
        return { usage: collectionUsage(row, meaning) };
      }
      const next = await client.query<{ source_word_id: number }>("SELECT COALESCE(MIN(source_word_id),0)-1 AS source_word_id FROM vocabulary_collection_item WHERE collection_id=$1 AND dataset='custom'", [collectionId]);
      const meaning = { text: prompt, partOfSpeech: "other" }; const sourceWordId = Number(next.rows[0].source_word_id);
      const inserted = await client.query<CollectionUsageItemRow>(`INSERT INTO vocabulary_collection_item(collection_id,dataset,source_word_id,word,meanings) VALUES($1,'custom',$2,$3,$4::jsonb) RETURNING collection_id,dataset,source_word_id,word,meanings,sentence_practice,created_at`, [collectionId, sourceWordId, word, JSON.stringify([meaning])]);
      return { usage: collectionUsage(inserted.rows[0], meaning) };
    });
    if (!saved) return apiError("Collection was not found", 404, "collection_not_found");
    if ("duplicate" in saved) return apiError("This word usage already exists", 409, "usage_exists");
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return apiError("This word usage already exists", 409, "usage_exists");
    return vocabularyAuthFailure(error) ?? internalError(error);
  }
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, internalError, isUniqueViolation } from "@lib/auth/http";
import { db, requestVocabularyUser, requireVocabularyUser, vocabularyAuthFailure } from "@lib/vocabulary-practice/server";

async function authenticated(request: Request) {
  const user = await requestVocabularyUser(request);
  return { user, error: requireVocabularyUser(user) };
}

function meaningsFromDatabase(value: unknown) {
  let parsed = value;
  if (typeof parsed === "string") { try { parsed = JSON.parse(parsed); } catch { return []; } }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap(item => { if (!item || typeof item !== "object") return []; const text = String((item as { text?: unknown }).text || "").trim(); const partOfSpeech = String((item as { partOfSpeech?: unknown }).partOfSpeech || "other"); return text ? [{ text, partOfSpeech }] : []; });
}

export async function GET(request: Request) {
  try {
    const { user, error } = await authenticated(request); if (error) return error;
    const [collections, items, progress] = await Promise.all([
      db.query<{ collection_id: string; name: string }>("SELECT collection_id, name FROM vocabulary_collection WHERE user_id=$1 ORDER BY created_at", [user!.sub]),
      db.query<{ collection_id: string; dataset: string; source_word_id: number; word: string; phonetic: string; meanings: unknown }>("SELECT i.collection_id,i.dataset,i.source_word_id,i.word,i.phonetic,i.meanings FROM vocabulary_collection_item i JOIN vocabulary_collection c USING(collection_id) WHERE c.user_id=$1 ORDER BY i.created_at ASC", [user!.sub]),
      db.query<{ dataset: string; mode: string; word_order: number[]; current_index: number }>("SELECT dataset,mode,word_order,current_index FROM vocabulary_drill_progress WHERE user_id=$1", [user!.sub]),
    ]);
    return NextResponse.json({ collections: collections.rows.map(c => ({ collectionId: c.collection_id, name: c.name, items: items.rows.filter(i => i.collection_id === c.collection_id).map(i => ({ dataset: i.dataset, sourceWordId: Number(i.source_word_id), word: i.word, phonetic: i.phonetic, meanings: meaningsFromDatabase(i.meanings) })) })), progress: progress.rows.map(p => ({ dataset: p.dataset, mode: p.mode, order: p.word_order.map(Number), index: p.current_index })) });
  } catch (cause) { return vocabularyAuthFailure(cause) ?? internalError(cause); }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await authenticated(request); if (error) return error;
    const body = await request.json().catch(() => null); if (!body || typeof body !== "object") return apiError("Invalid JSON", 400, "invalid_json");
    if (body.action === "create_collection") {
      const name = typeof body.name === "string" ? body.name.trim() : ""; if (!name || name.length > 80) return apiError("Invalid name", 400, "invalid_name");
      const row = await db.query<{ collection_id: string; name: string }>("INSERT INTO vocabulary_collection(collection_id,user_id,name) VALUES($1,$2,$3) RETURNING collection_id,name", [randomUUID(), user!.sub, name]);
      return NextResponse.json({ collection: { collectionId: row.rows[0].collection_id, name: row.rows[0].name, items: [] } }, { status: 201 });
    }
    if (body.action === "add_item") {
      const collectionId = String(body.collectionId || ""); const sourceWordId = Number(body.sourceWordId); const word = String(body.word || "").trim();
      if (!collectionId || !Number.isInteger(sourceWordId) || !word) return apiError("Invalid item", 400, "invalid_item");
      const owned = await db.query("SELECT 1 FROM vocabulary_collection WHERE collection_id=$1 AND user_id=$2", [collectionId, user!.sub]); if (!owned.rows.length) return apiError("Collection not found", 404, "not_found");
      await db.query("INSERT INTO vocabulary_collection_item(collection_id,dataset,source_word_id,word,phonetic,meanings) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT DO NOTHING", [collectionId, String(body.dataset || "ncee"), sourceWordId, word, String(body.phonetic || ""), JSON.stringify(Array.isArray(body.meanings) ? body.meanings : [])]);
      return NextResponse.json({ saved: true });
    }
    return apiError("Invalid action", 400, "invalid_action");
  } catch (cause) { if (isUniqueViolation(cause)) return apiError("Collection already exists", 409, "collection_exists"); return vocabularyAuthFailure(cause) ?? internalError(cause); }
}

export async function PUT(request: Request) {
  try {
    const { user, error } = await authenticated(request); if (error) return error;
    const body = await request.json().catch(() => null); if (!body || !["phonetic","meaning","word"].includes(body.mode) || !Array.isArray(body.order) || !Number.isInteger(body.index)) return apiError("Invalid progress", 400, "invalid_progress");
    await db.query(`INSERT INTO vocabulary_drill_progress(user_id,dataset,mode,word_order,current_index) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(user_id,dataset,mode) DO UPDATE SET word_order=EXCLUDED.word_order,current_index=EXCLUDED.current_index,updated_at=NOW()`, [user!.sub, String(body.dataset || "ncee"), body.mode, body.order, body.index]);
    return NextResponse.json({ saved: true });
  } catch (cause) { return vocabularyAuthFailure(cause) ?? internalError(cause); }
}

export async function DELETE(request: Request) {
  try {
    const { user, error } = await authenticated(request); if (error) return error;
    const url = new URL(request.url); const collectionId = url.searchParams.get("collectionId") || ""; const sourceWordId = Number(url.searchParams.get("sourceWordId"));
    if (!collectionId || !Number.isInteger(sourceWordId)) return apiError("Invalid item", 400, "invalid_item");
    const result = await db.query<{ source_word_id: number }>(`DELETE FROM vocabulary_collection_item i USING vocabulary_collection c
      WHERE i.collection_id=c.collection_id AND c.user_id=$1 AND i.collection_id=$2 AND i.source_word_id=$3 RETURNING i.source_word_id`, [user!.sub, collectionId, sourceWordId]);
    if (!result.rows.length) return apiError("Collection item not found", 404, "not_found");
    return new Response(null, { status: 204 });
  } catch (cause) { return vocabularyAuthFailure(cause) ?? internalError(cause); }
}

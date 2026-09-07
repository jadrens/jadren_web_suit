import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, internalError, isUniqueViolation } from "@lib/auth/http";
import { withTransaction } from "@lib/auth/db";
import { db, requestVocabularyUser, requireVocabularyUser, vocabularyAuthFailure } from "@lib/vocabulary-practice/server";

async function authenticated(request: Request) {
  const user = await requestVocabularyUser(request);
  return { user, error: requireVocabularyUser(user) };
}

function meaningsFromDatabase(value: unknown) {
  let parsed = value;
  if (typeof parsed === "string") { try { parsed = JSON.parse(parsed); } catch { return []; } }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap(item => { if (!item || typeof item !== "object") return []; const text = String((item as { text?: unknown }).text || "").trim(); const rawPart = String((item as { partOfSpeech?: unknown }).partOfSpeech || "other"); const partOfSpeech = rawPart === "vti" ? "v" : rawPart; return text ? [{ text, partOfSpeech }] : []; });
}

function arrayFromDatabase(value: unknown) {
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return []; } }
  return Array.isArray(value) ? value : [];
}

export async function GET(request: Request) {
  try {
    const { user, error } = await authenticated(request); if (error) return error;
    const [collections, items, progress] = await Promise.all([
      db.query<{ collection_id: string; name: string }>("SELECT collection_id, name FROM vocabulary_collection WHERE user_id=$1 ORDER BY created_at", [user!.sub]),
      db.query<{ collection_id: string; dataset: string; source_word_id: number; word: string; phonetic: string; phonetics: unknown; meanings: unknown; plural_forms: string; past_forms: string; example: string; definition: string }>("SELECT i.collection_id,i.dataset,i.source_word_id,i.word,i.phonetic,i.phonetics,i.meanings,i.plural_forms,i.past_forms,i.example,i.definition FROM vocabulary_collection_item i JOIN vocabulary_collection c USING(collection_id) WHERE c.user_id=$1 ORDER BY i.created_at ASC", [user!.sub]),
      db.query<{ dataset: string; mode: string; word_order: number[]; current_index: number }>("SELECT dataset,mode,word_order,current_index FROM vocabulary_drill_progress WHERE user_id=$1", [user!.sub]),
    ]);
    return NextResponse.json({ collections: collections.rows.map(c => ({ collectionId: c.collection_id, name: c.name, items: items.rows.filter(i => i.collection_id === c.collection_id).map(i => ({ dataset: i.dataset, sourceWordId: Number(i.source_word_id), word: i.word, phonetic: i.phonetic, phonetics: arrayFromDatabase(i.phonetics), meanings: meaningsFromDatabase(i.meanings), pluralForms: i.plural_forms, pastForms: i.past_forms, example: i.example, definition: i.definition })) })), progress: progress.rows.map(p => ({ dataset: p.dataset, mode: p.mode, order: p.word_order.map(Number), index: p.current_index })) });
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
      const collectionId = String(body.collectionId || ""); const requestedId = body.sourceWordId === undefined ? null : Number(body.sourceWordId); const word = String(body.word || "").trim(); const meanings = Array.isArray(body.meanings) ? body.meanings.filter((item: unknown) => item && typeof item === "object" && String((item as { text?: unknown }).text || "").trim()) : [];
      if (!collectionId || (requestedId !== null && !Number.isInteger(requestedId)) || !word || word.length > 100 || !meanings.length) return apiError("Invalid item", 400, "invalid_item");
      const item = await withTransaction(async client => {
        const owned = await client.query("SELECT 1 FROM vocabulary_collection WHERE collection_id=$1 AND user_id=$2 FOR UPDATE", [collectionId, user!.sub]); if (!owned.rows.length) return null;
        const dataset = requestedId === null ? "custom" : String(body.dataset || "ncee");
        let sourceWordId = requestedId;
        if (sourceWordId === null) { const next = await client.query<{ source_word_id: number }>("SELECT COALESCE(MIN(source_word_id),0)-1 AS source_word_id FROM vocabulary_collection_item WHERE collection_id=$1 AND dataset='custom'", [collectionId]); sourceWordId = Number(next.rows[0].source_word_id); }
        const phonetics = Array.isArray(body.phonetics) ? body.phonetics : [];
        const values = [collectionId, dataset, sourceWordId, word, String(body.phonetic || "").slice(0, 160), JSON.stringify(phonetics), JSON.stringify(meanings), String(body.pluralForms || "").slice(0, 240), String(body.pastForms || "").slice(0, 240), String(body.example || "").slice(0, 4000), String(body.definition || "").slice(0, 4000)];
        await client.query("INSERT INTO vocabulary_collection_item(collection_id,dataset,source_word_id,word,phonetic,phonetics,meanings,plural_forms,past_forms,example,definition) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11) ON CONFLICT DO NOTHING", values);
        return { dataset, sourceWordId, word, phonetic: values[4], phonetics, meanings, pluralForms: values[7], pastForms: values[8], example: values[9], definition: values[10] };
      });
      if (!item) return apiError("Collection not found", 404, "not_found");
      return NextResponse.json({ saved: true, item });
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
    const url = new URL(request.url); const collectionId = url.searchParams.get("collectionId") || ""; const sourceWordId = Number(url.searchParams.get("sourceWordId")); const dataset = url.searchParams.get("dataset");
    if (!collectionId || !Number.isInteger(sourceWordId)) return apiError("Invalid item", 400, "invalid_item");
    const result = await db.query<{ source_word_id: number }>(`DELETE FROM vocabulary_collection_item i USING vocabulary_collection c
      WHERE i.collection_id=c.collection_id AND c.user_id=$1 AND i.collection_id=$2 AND i.source_word_id=$3 AND ($4::text IS NULL OR i.dataset=$4) RETURNING i.source_word_id`, [user!.sub, collectionId, sourceWordId, dataset]);
    if (!result.rows.length) return apiError("Collection item not found", 404, "not_found");
    return new Response(null, { status: 204 });
  } catch (cause) { return vocabularyAuthFailure(cause) ?? internalError(cause); }
}

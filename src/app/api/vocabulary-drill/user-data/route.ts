import { databaseJsonArray } from "@lib/vocabulary-practice/database-json";
import { reviewSummary } from "@lib/vocabulary-practice/review-summary";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, internalError, isUniqueViolation } from "@lib/auth/http";
import { withTransaction } from "@lib/auth/db";
import { db, requestVocabularyUser, requireVocabularyUser, vocabularyAuthFailure } from "@lib/vocabulary-practice/server";

import { refreshCollectionOrders } from "@lib/vocabulary-practice/collection-order-server";
import { saveCollectionStats } from "@lib/vocabulary-practice/collection-stats-server";
import { validReviewEvents } from "@lib/vocabulary-practice/collection-reviews";
import { reviewItemKey } from "@lib/vocabulary-practice/collection-order";

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
    await refreshCollectionOrders(user!.sub);
    const [collections, items, progress] = await Promise.all([
      db.query<{ collection_id: string; name: string; practice_order: unknown; order_generated_at: Date }>("SELECT collection_id, name, practice_order, order_generated_at FROM vocabulary_collection WHERE user_id=$1 ORDER BY created_at", [user!.sub]),
      db.query<{ collection_id: string; dataset: string; source_word_id: number; word: string; phonetic: string; phonetics: unknown; meanings: unknown; plural_forms: string; past_forms: string; example: string; definition: string; appearance_count: number; correct_count: number; wrong_count: number; created_at: Date; last_reviewed_at: Date | null; memory_card: unknown }>("SELECT i.collection_id,i.dataset,i.source_word_id,i.word,i.phonetic,i.phonetics,i.meanings,i.plural_forms,i.past_forms,i.example,i.definition,i.appearance_count,i.correct_count,i.wrong_count,i.created_at,i.last_reviewed_at,i.memory_card FROM vocabulary_collection_item i JOIN vocabulary_collection c USING(collection_id) WHERE c.user_id=$1 ORDER BY i.created_at ASC", [user!.sub]),
      db.query<{ dataset: string; mode: string; word_order: number[]; current_index: number; order_generated_at: Date | null }>("SELECT dataset,mode,word_order,current_index,order_generated_at FROM vocabulary_drill_progress WHERE user_id=$1", [user!.sub]),
    ]);
    const now = Date.now();
    return NextResponse.json({ collections: collections.rows.map(c => { const practiceOrder = databaseJsonArray<string>(c.practice_order); const ranks = new Map(practiceOrder.map((key, index) => [key, index])); return ({ collectionId: c.collection_id, name: c.name, orderGeneratedAt: c.order_generated_at, practiceOrder, items: items.rows.filter(i => i.collection_id === c.collection_id).sort((a, b) => (ranks.get(reviewItemKey(a)) ?? Number.MAX_SAFE_INTEGER) - (ranks.get(reviewItemKey(b)) ?? Number.MAX_SAFE_INTEGER)).map(i => ({ dataset: i.dataset, sourceWordId: Number(i.source_word_id), word: i.word, phonetic: i.phonetic, phonetics: arrayFromDatabase(i.phonetics), meanings: meaningsFromDatabase(i.meanings), pluralForms: i.plural_forms, pastForms: i.past_forms, example: i.example, definition: i.definition, appearanceCount: Number(i.appearance_count), correctCount: Number(i.correct_count), wrongCount: Number(i.wrong_count), review: reviewSummary(i, now) })) }); }), progress: progress.rows.map(p => ({ dataset: p.dataset, mode: p.mode, order: p.word_order.map(Number), index: p.current_index, orderGeneratedAt: p.order_generated_at })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) { return vocabularyAuthFailure(cause) ?? internalError(cause); }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await authenticated(request); if (error) return error;
    const body = await request.json().catch(() => null); if (!body || typeof body !== "object") return apiError("Invalid JSON", 400, "invalid_json");
    if (body.action === "reorder_collection") {
      const collectionId = typeof body.collectionId === "string" ? body.collectionId : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collectionId)) return apiError("Invalid collection", 400, "invalid_collection");
      if (!await refreshCollectionOrders(user!.sub, collectionId)) return apiError("Collection not found", 404, "not_found");
      return NextResponse.json({ saved: true });
    }
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
        return { dataset, sourceWordId, word, phonetic: values[4], phonetics, meanings, pluralForms: values[7], pastForms: values[8], example: values[9], definition: values[10], appearanceCount: 0, correctCount: 0, wrongCount: 0 };
      });
      if (!item) return apiError("Collection not found", 404, "not_found");
      return NextResponse.json({ saved: true, item });
    }
    if (body.action === "transfer_item") {
      const collectionId = String(body.collectionId || ""); const dataset = String(body.dataset || ""); const sourceWordId = Number(body.sourceWordId);
      if (!collectionId || !dataset || !Number.isInteger(sourceWordId)) return apiError("Invalid item", 400, "invalid_item");
      const result = await withTransaction(async client => {
        const source = await client.query<{ name: string; transfer_origin_collection_id: string | null; transfer_origin_dataset: string | null; transfer_origin_source_word_id: number | null }>(`SELECT c.name,i.transfer_origin_collection_id,i.transfer_origin_dataset,i.transfer_origin_source_word_id FROM vocabulary_collection_item i JOIN vocabulary_collection c USING(collection_id)
          WHERE c.user_id=$1 AND i.collection_id=$2 AND i.dataset=$3 AND i.source_word_id=$4 FOR UPDATE`, [user!.sub, collectionId, dataset, sourceWordId]);
        if (!source.rows.length) return null;
        const isRestore = source.rows[0].name.toLocaleLowerCase() === "transferred";
        let destinationCollectionId: string; let destinationDataset = dataset; let destinationSourceWordId = sourceWordId;
        if (isRestore) {
          destinationCollectionId = source.rows[0].transfer_origin_collection_id || "";
          destinationDataset = source.rows[0].transfer_origin_dataset || ""; destinationSourceWordId = Number(source.rows[0].transfer_origin_source_word_id);
          if (!destinationCollectionId || !destinationDataset || !Number.isInteger(destinationSourceWordId)) throw new Error("transfer_origin_missing");
          const owned = await client.query("SELECT 1 FROM vocabulary_collection WHERE collection_id=$1 AND user_id=$2 FOR UPDATE", [destinationCollectionId, user!.sub]);
          if (!owned.rows.length) throw new Error("transfer_origin_missing");
        } else {
          const existing = await client.query<{ collection_id: string }>("SELECT collection_id FROM vocabulary_collection WHERE user_id=$1 AND LOWER(name)='transferred' ORDER BY created_at LIMIT 1 FOR UPDATE", [user!.sub]);
          if (existing.rows.length) destinationCollectionId = existing.rows[0].collection_id;
          else { destinationCollectionId = randomUUID(); await client.query("INSERT INTO vocabulary_collection(collection_id,user_id,name) VALUES($1,$2,'transferred')", [destinationCollectionId, user!.sub]); }
          const collision = await client.query("SELECT 1 FROM vocabulary_collection_item WHERE collection_id=$1 AND dataset=$2 AND source_word_id=$3", [destinationCollectionId, destinationDataset, destinationSourceWordId]);
          if (collision.rows.length) { const next = await client.query<{ source_word_id: number }>("SELECT COALESCE(MIN(source_word_id),0)-1 AS source_word_id FROM vocabulary_collection_item WHERE collection_id=$1 AND dataset=$2", [destinationCollectionId, destinationDataset]); destinationSourceWordId = Number(next.rows[0].source_word_id); }
        }
        const inserted = await client.query<{ source_word_id: number }>(`INSERT INTO vocabulary_collection_item(collection_id,dataset,source_word_id,word,phonetic,phonetics,meanings,plural_forms,past_forms,example,definition,transfer_origin_collection_id,transfer_origin_dataset,transfer_origin_source_word_id,appearance_count,correct_count,wrong_count,last_reviewed_at,memory_card,review_seed,review_history)
          SELECT $4,$5,$6,word,phonetic,phonetics,meanings,plural_forms,past_forms,example,definition,$7,$8,$9,appearance_count,correct_count,wrong_count,last_reviewed_at,memory_card,review_seed,review_history FROM vocabulary_collection_item
          WHERE collection_id=$1 AND dataset=$2 AND source_word_id=$3 ON CONFLICT DO NOTHING RETURNING source_word_id`, [collectionId, dataset, sourceWordId, destinationCollectionId, destinationDataset, destinationSourceWordId, isRestore ? null : collectionId, isRestore ? null : dataset, isRestore ? null : sourceWordId]);
        if (!inserted.rows.length) throw new Error("transfer_destination_duplicate");
        await client.query("DELETE FROM vocabulary_collection_item WHERE collection_id=$1 AND dataset=$2 AND source_word_id=$3", [collectionId, dataset, sourceWordId]);
        return { restored: isRestore, destinationCollectionId };
      });
      if (!result) return apiError("Collection item not found", 404, "not_found");
      return NextResponse.json(result);
    }
    if (body.action === "save_stat_deltas") {
      if (!Array.isArray(body.deltas) || body.deltas.length > 500) return apiError("Invalid stat deltas", 400, "invalid_stat_deltas");
      const deltas: Array<{ collectionId: string; dataset: string; sourceWordId: number; reviews?: import("@lib/vocabulary-practice/collection-memory").ReviewEvent[]; lastReviewedAt: string | null; appearances: number; correct: number; wrong: number }> = body.deltas.map((raw: unknown) => { const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}; return { collectionId: String(item.collectionId || ""), dataset: String(item.dataset || ""), sourceWordId: Number(item.sourceWordId), reviews: item.reviews as import("@lib/vocabulary-practice/collection-memory").ReviewEvent[] | undefined, lastReviewedAt: typeof item.lastReviewedAt === "string" && Number.isFinite(Date.parse(item.lastReviewedAt)) ? new Date(Math.min(Date.now(), Date.parse(item.lastReviewedAt))).toISOString() : null, appearances: Number(item.appearances), correct: Number(item.correct), wrong: Number(item.wrong) }; });
      if (deltas.some(item => !validReviewEvents(item.reviews) || !item.collectionId || !item.dataset || !Number.isInteger(item.sourceWordId) || ![item.appearances, item.correct, item.wrong].every(value => Number.isInteger(value) && value >= 0 && value <= 10000))) return apiError("Invalid stat deltas", 400, "invalid_stat_deltas");
      await saveCollectionStats(user!.sub, deltas);
      return NextResponse.json({ saved: true });
    }
    return apiError("Invalid action", 400, "invalid_action");
  } catch (cause) { if (isUniqueViolation(cause)) return apiError("Collection already exists", 409, "collection_exists"); return vocabularyAuthFailure(cause) ?? internalError(cause); }
}

export async function PUT(request: Request) {
  try {
    const { user, error } = await authenticated(request); if (error) return error;
    const body = await request.json().catch(() => null); if (!body || !["phonetic","meaning","word"].includes(body.mode) || !Array.isArray(body.order) || !Number.isInteger(body.index)) return apiError("Invalid progress", 400, "invalid_progress");
    const order = body.order.map(Number); if (!order.every((value: number) => Number.isInteger(value))) return apiError("Invalid progress", 400, "invalid_progress");
    const orderGeneratedAt = typeof body.orderGeneratedAt === "string" && Number.isFinite(Date.parse(body.orderGeneratedAt)) ? body.orderGeneratedAt : null;
    const postgresOrder = `{${order.join(",")}}`;
    await db.query(`INSERT INTO vocabulary_drill_progress(user_id,dataset,mode,word_order,current_index,order_generated_at) VALUES($1,$2,$3,$4::integer[],$5,$6)
      ON CONFLICT(user_id,dataset,mode) DO UPDATE SET word_order=EXCLUDED.word_order,current_index=EXCLUDED.current_index,order_generated_at=EXCLUDED.order_generated_at,updated_at=NOW()`, [user!.sub, String(body.dataset || "ncee"), body.mode, postgresOrder, body.index, orderGeneratedAt]);
    return NextResponse.json({ saved: true });
  } catch (cause) { return vocabularyAuthFailure(cause) ?? internalError(cause); }
}

export async function DELETE(request: Request) {
  try {
    const { user, error } = await authenticated(request); if (error) return error;
    const url = new URL(request.url); const collectionId = url.searchParams.get("collectionId") || ""; const sourceWordIdParam = url.searchParams.get("sourceWordId"); const dataset = url.searchParams.get("dataset");
    if (collectionId && sourceWordIdParam === null) {
      const deleted = await withTransaction(async client => {
        const result = await client.query<{ collection_id: string }>("DELETE FROM vocabulary_collection WHERE collection_id=$1 AND user_id=$2 RETURNING collection_id", [collectionId, user!.sub]);
        if (!result.rows.length) return false;
        await client.query("DELETE FROM vocabulary_drill_progress WHERE user_id=$1 AND dataset=$2", [user!.sub, `collection:${collectionId}`]);
        return true;
      });
      if (!deleted) return apiError("Collection not found", 404, "not_found");
      return new Response(null, { status: 204 });
    }
    const sourceWordId = Number(sourceWordIdParam);
    if (!collectionId || !Number.isInteger(sourceWordId)) return apiError("Invalid item", 400, "invalid_item");
    const result = await db.query<{ source_word_id: number }>(`DELETE FROM vocabulary_collection_item i USING vocabulary_collection c
      WHERE i.collection_id=c.collection_id AND c.user_id=$1 AND i.collection_id=$2 AND i.source_word_id=$3 AND ($4::text IS NULL OR i.dataset=$4) RETURNING i.source_word_id`, [user!.sub, collectionId, sourceWordId, dataset]);
    if (!result.rows.length) return apiError("Collection item not found", 404, "not_found");
    return new Response(null, { status: 204 });
  } catch (cause) { return vocabularyAuthFailure(cause) ?? internalError(cause); }
}

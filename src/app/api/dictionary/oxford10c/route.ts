import { NextResponse } from "next/server";
import { lookupChineseDictionaryEntry, lookupDictionaryEntry } from "@lib/dictionary/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_HEADERS = { "Cache-Control": "public, max-age=300, s-maxage=86400" };

function error(code: string, message: string, status: number) {
  return NextResponse.json({ code, error: message }, { status });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const word = params.get("word")?.trim() || "";
  const direction = params.get("direction") || "auto";
  if (!word || word.length > 120 || /[\u0000-\u001f\u007f]/.test(word)) {
    return error("invalid_word", "word must contain 1 to 120 printable characters", 400);
  }
  if (!["auto", "en-zh", "zh-en"].includes(direction)) {
    return error("invalid_direction", "direction must be auto, en-zh, or zh-en", 400);
  }

  try {
    const reverse = direction === "zh-en" || (direction === "auto" && /\p{Script=Han}/u.test(word));
    const result = reverse ? lookupChineseDictionaryEntry(word) : lookupDictionaryEntry(word);
    if (!result) return error("word_not_found", "Dictionary entry not found", 404);
    return NextResponse.json(result, { headers: CACHE_HEADERS });
  } catch (cause) {
    console.error("Dictionary lookup failed", cause);
    return error("dictionary_unavailable", "Dictionary service is unavailable", 503);
  }
}

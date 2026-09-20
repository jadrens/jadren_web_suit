import { NextResponse } from "next/server";
import { suggestChineseDictionaryEntries, suggestDictionaryEntries } from "@lib/dictionary/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(code: string, message: string, status: number) {
  return NextResponse.json({ code, error: message }, { status });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() || "";
  const direction = params.get("direction") || "auto";
  const requestedLimit = Number(params.get("limit") || "20");
  if (!query || query.length > 120 || /[\u0000-\u001f\u007f]/.test(query)) {
    return error("invalid_query", "q must contain 1 to 120 printable characters", 400);
  }
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 50) {
    return error("invalid_limit", "limit must be an integer from 1 to 50", 400);
  }
  if (!["auto", "en-zh", "zh-en"].includes(direction)) {
    return error("invalid_direction", "direction must be auto, en-zh, or zh-en", 400);
  }

  try {
    const reverse = direction === "zh-en" || (direction === "auto" && /\p{Script=Han}/u.test(query));
    const results = reverse
      ? suggestChineseDictionaryEntries(query, requestedLimit)
      : suggestDictionaryEntries(query, requestedLimit);
    return NextResponse.json(
      { query, count: results.length, results },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=3600" } },
    );
  } catch (cause) {
    console.error("Dictionary search failed", cause);
    return error("dictionary_unavailable", "Dictionary service is unavailable", 503);
  }
}

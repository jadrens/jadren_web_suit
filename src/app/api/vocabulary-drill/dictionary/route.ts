import { NextResponse } from "next/server";
import { apiError, internalError } from "@lib/auth/http";

interface DictionaryDefinition { definition?: unknown; example?: unknown }
interface DictionaryMeaning { partOfSpeech?: unknown; definitions?: DictionaryDefinition[] }
interface DictionaryEntry { phonetic?: unknown; phonetics?: Array<{ text?: unknown; audio?: unknown }>; meanings?: DictionaryMeaning[] }

export async function GET(request: Request) {
  const word = new URL(request.url).searchParams.get("word")?.trim() || "";
  if (!/^[a-zA-Z][a-zA-Z '-]{0,98}$/.test(word)) return apiError("Invalid word", 400, "invalid_word");
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { headers: { accept: "application/json" }, next: { revalidate: 86400 } });
    if (response.status === 404) return apiError("Word not found", 404, "word_not_found");
    if (!response.ok) throw new Error(`Dictionary API returned ${response.status}`);
    const entries = await response.json() as DictionaryEntry[];
    const phonetics = entries.flatMap(entry => entry.phonetics || []).flatMap(item => {
      const text = String(item.text || "").trim(); const audio = String(item.audio || "").trim();
      if (!text) return [];
      const accent = /[_-](us|us_|american)/i.test(audio) ? "us" : /[_-](gb|uk|gb_|british)/i.test(audio) ? "uk" : "other";
      return [{ accent, text, ...(audio ? { audio: audio.startsWith("//") ? `https:${audio}` : audio } : {}) }];
    }).filter((item, index, all) => all.findIndex(candidate => candidate.text === item.text && candidate.accent === item.accent) === index);
    const definitions = entries.flatMap(entry => entry.meanings || []).flatMap(meaning => (meaning.definitions || []).map(definition => ({ partOfSpeech: String(meaning.partOfSpeech || "other"), definition: String(definition.definition || "").trim(), example: String(definition.example || "").trim() }))).filter(item => item.definition);
    return NextResponse.json({ phonetic: phonetics[0]?.text || String(entries[0]?.phonetic || ""), phonetics, definition: definitions[0]?.definition || "", example: definitions.find(item => item.example)?.example || "", definitions });
  } catch (cause) { return internalError(cause); }
}

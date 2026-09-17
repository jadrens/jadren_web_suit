import type { DictionaryEntry } from "@lib/dictionary/server";
import type { DrillMeaning, DrillPartOfSpeech } from "@lib/client-api/types";

export interface DictionaryQuizSense {
  key: string;
  partOfSpeech: DrillPartOfSpeech;
  definitionEn: string;
  definitionZh: string;
  registers: string[];
}

function partOfSpeech(value: unknown): DrillPartOfSpeech {
  if (typeof value !== "string") return "other";
  const part = value.trim().toLocaleLowerCase("en");
  if (/^(noun|n\.)/.test(part)) return "n";
  if (/^(verb|auxiliary verb|modal verb|linking verb)/.test(part)) return "v";
  if (/^(adj\.|adjective)/.test(part)) return "adj";
  if (/^(adv\.|adverb)/.test(part)) return "adv";
  if (/^(prep\.|preposition)/.test(part)) return "prep";
  if (/^(conj\.|conjunction)/.test(part)) return "conj";
  if (/^(pron\.|pronoun)/.test(part)) return "pron";
  if (/^(exclamation|interjection)/.test(part)) return "int";
  if (/^(number|ordinal number|numeral)/.test(part)) return "num";
  if (/^(definite article|indefinite article|article)/.test(part)) return "art";
  return "other";
}

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map(item => item.trim()) : [];
}

function candidate(value: unknown): DictionaryQuizSense | null {
  if (!value || typeof value !== "object") return null;
  const sense = value as Record<string, unknown>;
  const key = typeof sense.key === "string" ? sense.key.trim() : "";
  const definitionZh = typeof sense.definition_zh === "string" ? sense.definition_zh.trim() : "";
  if (!key || !definitionZh) return null;
  return {
    key,
    partOfSpeech: partOfSpeech(sense.pos),
    definitionEn: typeof sense.definition_en === "string" ? sense.definition_en.trim() : "",
    definitionZh,
    registers: textArray(sense.registers),
  };
}

export function dictionaryQuizSenses(entry: DictionaryEntry): DictionaryQuizSense[] {
  const phraseSenses = entry.phrases.flatMap(value => {
    if (!value || typeof value !== "object") return [];
    const senses = (value as { senses?: unknown }).senses;
    return Array.isArray(senses) ? senses : [];
  });
  const seen = new Set<string>();
  return [...entry.senses, ...phraseSenses].flatMap(value => {
    const parsed = candidate(value);
    if (!parsed || seen.has(parsed.key)) return [];
    seen.add(parsed.key);
    return [parsed];
  });
}

export function meaningsForSenseKeys(senses: DictionaryQuizSense[], senseKeys: unknown): DrillMeaning[] {
  if (!Array.isArray(senseKeys)) return [];
  const requested = new Set(senseKeys.filter((key): key is string => typeof key === "string"));
  return senses.filter(sense => requested.has(sense.key)).map(sense => ({
    text: sense.definitionZh,
    partOfSpeech: sense.partOfSpeech,
  }));
}

export function hintsForSenseKeys(senses: DictionaryQuizSense[], senseKeys: unknown, meanings: DrillMeaning[]): string[] {
  if (!Array.isArray(senseKeys)) return meanings.map(() => "");
  const requested = new Set(senseKeys.filter((key): key is string => typeof key === "string"));
  const selected = senses.filter(sense => requested.has(sense.key));
  return meanings.map((meaning, index) => {
    const sense = selected[index];
    return sense?.definitionZh === meaning.text && sense.partOfSpeech === meaning.partOfSpeech ? sense.definitionEn : "";
  });
}

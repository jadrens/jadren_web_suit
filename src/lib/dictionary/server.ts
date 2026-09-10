import { Database } from "bun:sqlite";
import { resolve } from "node:path";

const DEFAULT_DATABASE_PATH = "database/oxford-10-en2cn.sqlite3";

export interface DictionaryEntry {
  word: string;
  display_word: string | null;
  pronunciation: { br: string | null; us: string | null };
  labels: Record<string, unknown>;
  forms: string[];
  sense_groups: unknown[];
  senses: unknown[];
  phrases: unknown[];
  warnings: string[];
}

export interface DictionaryLookupResult {
  query: string;
  lookupKey: string;
  resolvedKey: string;
  isAlias: boolean;
  entry: DictionaryEntry;
}

export interface DictionarySuggestion {
  word: string;
  lookupKey: string;
  isAlias: boolean;
  target: string | null;
}

interface EntryRow {
  lookup_key: string;
  entry_json: string;
}

interface AliasRow {
  target_key: string;
}

interface SuggestionRow {
  word: string;
  lookup_key: string;
  is_alias: number;
  target: string | null;
}

declare global {
  var __oxfordDictionaryDatabase: Database | undefined;
}

export function normalizeDictionaryKey(value: string): string {
  return value.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
}

function databasePath(): string {
  const configured = process.env.OXFORD_DICTIONARY_DB?.trim();
  return resolve(process.cwd(), configured || DEFAULT_DATABASE_PATH);
}

function getDatabase(): Database {
  if (!globalThis.__oxfordDictionaryDatabase) {
    const database = new Database(databasePath(), { readonly: true, strict: true });
    database.exec("PRAGMA query_only=ON");
    globalThis.__oxfordDictionaryDatabase = database;
  }
  return globalThis.__oxfordDictionaryDatabase;
}

function findEntry(db: Database, lookupKey: string): EntryRow | null {
  return db.query<EntryRow, [string]>(
    `SELECT lookup_key, entry_json
       FROM entries
      WHERE lookup_key = ?
      ORDER BY id
      LIMIT 1`,
  ).get(lookupKey);
}

export function lookupDictionaryEntry(query: string): DictionaryLookupResult | null {
  const lookupKey = normalizeDictionaryKey(query);
  if (!lookupKey) return null;

  const db = getDatabase();
  let row = findEntry(db, lookupKey);
  let resolvedKey = lookupKey;
  let isAlias = false;

  if (!row) {
    const alias = db.query<AliasRow, [string]>(
      `SELECT target_key
         FROM aliases
        WHERE alias_key = ?
        ORDER BY target_key
        LIMIT 1`,
    ).get(lookupKey);
    if (!alias) return null;
    resolvedKey = alias.target_key;
    row = findEntry(db, resolvedKey);
    isAlias = true;
  }

  if (!row) return null;
  return {
    query,
    lookupKey,
    resolvedKey,
    isAlias,
    entry: JSON.parse(row.entry_json) as DictionaryEntry,
  };
}

export function suggestDictionaryEntries(query: string, limit: number): DictionarySuggestion[] {
  const lookupKey = normalizeDictionaryKey(query);
  if (!lookupKey) return [];
  const upperBound = `${lookupKey}\u{10ffff}`;
  const rows = getDatabase().query<SuggestionRow, [string, string, string, string, number]>(
    `SELECT word, lookup_key, is_alias, target
       FROM (
         SELECT COALESCE(display_word, source_key) AS word,
                lookup_key, 0 AS is_alias, NULL AS target
           FROM entries
          WHERE lookup_key >= ? AND lookup_key < ?
         UNION ALL
         SELECT alias_source AS word, alias_key AS lookup_key,
                1 AS is_alias, target_key AS target
           FROM aliases
          WHERE alias_key >= ? AND alias_key < ?
       )
      GROUP BY lookup_key, target
      ORDER BY lookup_key, is_alias
      LIMIT ?`,
  ).all(lookupKey, upperBound, lookupKey, upperBound, limit);

  return rows.map((row) => ({
    word: row.word,
    lookupKey: row.lookup_key,
    isAlias: row.is_alias === 1,
    target: row.target,
  }));
}

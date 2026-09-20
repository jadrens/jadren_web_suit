import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import { oxfordDictionaryDatabasePath } from "../database/paths";

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
  meaning?: string | null;
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
  meaning?: string | null;
}

declare global {
  var __oxfordDictionaryDatabase: Database | undefined;
}

export function normalizeDictionaryKey(value: string): string {
  return value.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
}

function databasePath(): string {
  return resolve(process.cwd(), oxfordDictionaryDatabasePath());
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

function chineseFtsQuery(value: string, prefix: boolean): string {
  return value.trim().split(/\s+/).filter(Boolean)
    .map(token => `"${token.replaceAll('"', '""')}"${prefix ? "*" : ""}`)
    .join(" AND ");
}

function findChineseEntry(db: Database, query: string): EntryRow | null {
  const match = chineseFtsQuery(query, false);
  if (!match) return null;
  return db.query<EntryRow, [string, string, string]>(
    `WITH matches AS (
       SELECT rowid, bm25(entry_search) AS relevance
         FROM entry_search
        WHERE entry_search MATCH ?
     )
     SELECT e.lookup_key, e.entry_json
       FROM matches
       JOIN entries e ON e.id = matches.rowid
      ORDER BY CASE
        WHEN EXISTS (SELECT 1 FROM senses s WHERE s.entry_id = e.id AND trim(s.definition_zh) = ?) THEN 0
        WHEN EXISTS (SELECT 1 FROM senses s WHERE s.entry_id = e.id AND s.definition_zh LIKE ?) THEN 1
        ELSE 2
      END, matches.relevance, e.lookup_key
      LIMIT 1`,
  ).get(match, query, `%${query}%`);
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

export function lookupChineseDictionaryEntry(query: string): DictionaryLookupResult | null {
  const lookupKey = normalizeDictionaryKey(query);
  if (!lookupKey) return null;
  const row = findChineseEntry(getDatabase(), lookupKey);
  if (!row) return null;
  return {
    query,
    lookupKey,
    resolvedKey: row.lookup_key,
    isAlias: true,
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

export function suggestChineseDictionaryEntries(query: string, limit: number): DictionarySuggestion[] {
  const lookupKey = normalizeDictionaryKey(query);
  const match = chineseFtsQuery(lookupKey, true);
  if (!match) return [];
  const rows = getDatabase().query<SuggestionRow, [string, string, string, string, string, number]>(
    `WITH matches AS (
       SELECT rowid, bm25(entry_search) AS relevance
         FROM entry_search
        WHERE entry_search MATCH ?
     )
     SELECT COALESCE(e.display_word, e.source_key) AS word,
            e.lookup_key, 0 AS is_alias, NULL AS target,
            (SELECT s.definition_zh
               FROM senses s
              WHERE s.entry_id = e.id AND s.definition_zh LIKE ?
              ORDER BY CASE WHEN trim(s.definition_zh) = ? THEN 0 ELSE 1 END, s.sense_index
              LIMIT 1) AS meaning
       FROM matches
       JOIN entries e ON e.id = matches.rowid
      ORDER BY CASE
        WHEN EXISTS (SELECT 1 FROM senses s WHERE s.entry_id = e.id AND trim(s.definition_zh) = ?) THEN 0
        WHEN EXISTS (SELECT 1 FROM senses s WHERE s.entry_id = e.id AND s.definition_zh LIKE ?) THEN 1
        ELSE 2
      END, matches.relevance, e.lookup_key
      LIMIT ?`,
  ).all(match, `%${lookupKey}%`, lookupKey, lookupKey, `%${lookupKey}%`, limit);

  return rows.map(row => ({
    word: row.word,
    lookupKey: row.lookup_key,
    isAlias: false,
    target: null,
    meaning: row.meaning,
  }));
}

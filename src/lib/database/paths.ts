export const DEFAULT_OXFORD_DICTIONARY_DB = ".data/database/oxford-10-en2cn.sqlite3";
export const DEFAULT_NCEE_DATABASE_DB = ".data/database/NCEE.db";

export function oxfordDictionaryDatabasePath(): string {
  return process.env.OXFORD_DICTIONARY_DB?.trim() || DEFAULT_OXFORD_DICTIONARY_DB;
}

export function nceeDatabasePath(): string {
  return process.env.NCEE_DATABASE_DB?.trim() || DEFAULT_NCEE_DATABASE_DB;
}

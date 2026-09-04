import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database } from "bun:sqlite";

const sourceRoot = resolve(process.argv[2] || "/home/dragonren/cache/git/gaokao-vocab");
const outputPath = resolve(process.argv[3] || "database/NCEE.db");

function templateBody(path: string) {
  const source = readFileSync(path, "utf8");
  const match = source.match(/=\s*`([\s\S]*)`;\s*$/);
  if (!match) throw new Error(`Unable to extract vocabulary template from ${path}`);
  return match[1];
}

function hasChinese(value: string) { return /[\u3400-\u9fff]/.test(value); }
function isPhonetic(value: string) { return value.startsWith("[") || value.startsWith("/"); }
function isPartOfSpeech(value: string) { return /^(?:n\.|v\.|vi\.|vt\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|art\.|num\.)/.test(value); }

interface Word { english: string; phonetic: string; chinese: string }

function cleanEnglishHeadword(value: string) {
  // Parentheses in the source contain inflections, plurals, gendered variants,
  // or alternative spellings. Exercises ask for one canonical headword only.
  const attachedInsertion = /\S\([^)]*\)\S/.test(value);
  const cleaned = attachedInsertion
    ? value.slice(0, value.indexOf("("))
    : value.replace(/\s*\([^)]*\)/g, " ");
  return cleaned
    .replace(/\s+(?:donˈt|canˈt)\s*=.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseVocabulary(raw: string) {
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  const words: Word[] = [];
  let current: Partial<Word> = {};
  const finish = () => {
    if (!current.english) return;
    words.push({ english: current.english, phonetic: current.phonetic || "", chinese: current.chinese || "暂无释义" });
    current = {};
  };
  for (const line of lines) {
    if (isPhonetic(line)) current.phonetic = line === "[]" || line === "//" ? "" : line;
    else if (hasChinese(line) || isPartOfSpeech(line)) current.chinese = current.chinese ? `${current.chinese} ${line}` : line;
    else { finish(); current.english = line; }
  }
  finish();
  return words;
}

const raw = [1, 2, 3].map((part) => templateBody(resolve(sourceRoot, `src/data_chunk${part}.ts`))).join("");
const parsedWords = parseVocabulary(raw).map((word) => ({ ...word, english: cleanEnglishHeadword(word.english) })).filter((word) => word.english);
const words = [...parsedWords.reduce((byWord, word) => {
  const key = word.english.toLocaleLowerCase(); const existing = byWord.get(key);
  if (!existing) byWord.set(key, word);
  else {
    if (!existing.phonetic && word.phonetic) existing.phonetic = word.phonetic;
    if (word.chinese && !existing.chinese.includes(word.chinese)) existing.chinese += `；${word.chinese}`;
  }
  return byWord;
}, new Map<string, Word>()).values()];
if (words.length < 3000) throw new Error(`Unexpectedly small vocabulary: ${words.length}`);

const db = new Database(outputPath, { create: true });
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
db.transaction(() => {
  db.exec(`
    DROP TABLE IF EXISTS metadata;
    DROP TABLE IF EXISTS words;
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE words (
      id INTEGER PRIMARY KEY,
      english TEXT NOT NULL,
      english_normalized TEXT NOT NULL,
      phonetic TEXT NOT NULL,
      chinese TEXT NOT NULL
    );
    CREATE INDEX words_english_normalized_idx ON words (english_normalized);
    CREATE INDEX words_chinese_idx ON words (chinese);
  `);
  const insertWord = db.prepare("INSERT INTO words (english, english_normalized, phonetic, chinese) VALUES (?, ?, ?, ?)");
  for (const word of words) insertWord.run(word.english, word.english.toLocaleLowerCase().replace(/\s+/g, " ").trim(), word.phonetic, word.chinese);
  const insertMeta = db.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)");
  const metadata = {
    name: "NCEE Vocabulary Database",
    full_name: "National College Entrance Examination Vocabulary Database",
    source: sourceRoot,
    source_repository: "https://github.com/Jimmy-xuzimo/gaokao-vocab",
    source_commit: "137ceb9faa9d45d956c92eef45c945f930b5c179",
    source_license: "MIT",
    word_count: String(words.length),
    generated_at: new Date().toISOString(),
  };
  for (const [key, value] of Object.entries(metadata)) insertMeta.run(key, value);
})();
db.exec("PRAGMA optimize;");
db.exec("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE;");
db.close();
console.log(`Created ${outputPath} with ${words.length} words.`);

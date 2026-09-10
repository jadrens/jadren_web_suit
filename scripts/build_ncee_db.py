#!/usr/bin/env python3
"""Build the NCEE practice database from a headword list and oxford10c data.

Only headwords are taken from gaokao-vocab. Pronunciations, meanings and
examples come exclusively from the local oxford10c SQLite database.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_SOURCE = Path("/home/dragonren/cache/git/gaokao-vocab/src")
DEFAULT_DICTIONARY = Path("database/oxford-10-en2cn.sqlite3")
DEFAULT_OUTPUT = Path("database/NCEE.db")

POS = {
    "noun": "n", "verb": "v", "adjective": "adj", "adverb": "adv",
    "preposition": "prep", "conjunction": "conj", "pronoun": "pron",
    "exclamation": "int", "interjection": "int", "article": "art",
    "determiner": "art", "number": "num", "numeral": "num",
}
PHONETIC_RE = re.compile(r"^(?:\[.*\]|/.*?/?)$")
CHINESE_RE = re.compile(r"[\u3400-\u9fff]")
POS_RE = re.compile(r"^(?:n|v|vi|vt|adj|adv|prep|conj|pron|int|art|num)\.")


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower().replace("’", "'"))


def clean_headword(value: str) -> str:
    attached = re.search(r"\S\([^)]*\)\S", value)
    value = value[: value.index("(")] if attached else re.sub(r"\s*\([^)]*\)", " ", value)
    value = re.sub(r"\s+(?:donˈt|canˈt)\s*=.*$", "", value, flags=re.I)
    return re.sub(r"\s+", " ", value).strip()


def template_body(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"=\s*`([\s\S]*)`;\s*$", text)
    if not match:
        raise ValueError(f"Cannot extract vocabulary template from {path}")
    return match.group(1)


def extract_headwords(source: Path) -> list[str]:
    raw = "".join(template_body(source / f"data_chunk{part}.ts") for part in (1, 2, 3))
    headwords: OrderedDict[str, str] = OrderedDict()
    for line in (item.strip() for item in raw.splitlines()):
        if not line or PHONETIC_RE.match(line) or CHINESE_RE.search(line) or POS_RE.match(line):
            continue
        word = clean_headword(line)
        if word:
            headwords.setdefault(normalize(word), word)
    if len(headwords) < 3000:
        raise ValueError(f"Unexpectedly small vocabulary: {len(headwords)}")
    return list(headwords.values())


def unique(items: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in items:
        cleaned = re.sub(r"\s+", " ", item).strip(" ；;/")
        key = normalize(cleaned)
        if cleaned and key not in seen:
            result.append(cleaned)
            seen.add(key)
    return result


def relevant_senses(entry: dict) -> list[dict]:
    senses = entry.get("senses") or []
    if senses:
        return senses
    entry_key = normalize(str(entry.get("word") or entry.get("display_word") or ""))
    exact_phrases = [
        phrase for phrase in entry.get("phrases") or []
        if normalize(str(phrase.get("phrase") or phrase.get("display_phrase") or "").replace("ˈ", "").replace("ˌ", "")) == entry_key
    ]
    return [sense for phrase in exact_phrases for sense in phrase.get("senses") or []]


def dictionary_data(entry: dict) -> tuple[str, str, list[dict], list[dict]]:
    pronunciation = entry.get("pronunciation") or {}
    br = str(pronunciation.get("br") or "")
    us = str(pronunciation.get("us") or "")
    grouped: OrderedDict[str, list[str]] = OrderedDict()
    examples: list[dict] = []
    seen_examples: set[tuple[str, str]] = set()
    for sense in relevant_senses(entry):
        definition = str(sense.get("definition_zh") or "").strip()
        part = POS.get(str(sense.get("pos") or "").lower().rstrip("."), "other")
        if definition:
            grouped.setdefault(part, []).append(definition)
        for example in sense.get("examples") or []:
            en, zh = str(example.get("en") or "").strip(), str(example.get("zh") or "").strip()
            key = (en, zh)
            if (en or zh) and key not in seen_examples:
                examples.append({"en": en, "zh": zh})
                seen_examples.add(key)
    meanings = [
        {"partOfSpeech": part, "text": "/".join(unique(definitions))}
        for part, definitions in grouped.items() if unique(definitions)
    ]
    return br, us, meanings, examples


def resolve_entry(db: sqlite3.Connection, lookup_key: str) -> dict | None:
    row = db.execute("SELECT entry_json FROM entries WHERE lookup_key=? ORDER BY id LIMIT 1", (lookup_key,)).fetchone()
    if not row:
        alias = db.execute("SELECT target_key FROM aliases WHERE alias_key=? ORDER BY target_key LIMIT 1", (lookup_key,)).fetchone()
        if alias:
            row = db.execute("SELECT entry_json FROM entries WHERE lookup_key=? ORDER BY id LIMIT 1", (alias[0],)).fetchone()
    return json.loads(row[0]) if row else None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--dictionary", type=Path, default=DEFAULT_DICTIONARY)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    words = extract_headwords(args.source)
    dictionary = sqlite3.connect(f"file:{args.dictionary.resolve()}?mode=ro", uri=True)
    output = sqlite3.connect(args.output)
    matched = with_meanings = with_phonetics = 0
    try:
        output.executescript("""
            PRAGMA journal_mode=WAL;
            DROP TABLE IF EXISTS metadata;
            DROP TABLE IF EXISTS words;
            CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE words (
              id INTEGER PRIMARY KEY,
              english TEXT NOT NULL,
              english_normalized TEXT NOT NULL,
              phonetic TEXT NOT NULL,
              chinese TEXT NOT NULL,
              phonetic_br TEXT NOT NULL DEFAULT '',
              phonetic_us TEXT NOT NULL DEFAULT '',
              meanings_json TEXT NOT NULL DEFAULT '[]',
              examples_json TEXT NOT NULL DEFAULT '[]'
            );
            CREATE INDEX words_english_normalized_idx ON words (english_normalized);
            CREATE INDEX words_chinese_idx ON words (chinese);
        """)
        for word in words:
            entry = resolve_entry(dictionary, normalize(word))
            br = us = ""
            meanings: list[dict] = []
            examples: list[dict] = []
            if entry:
                matched += 1
                br, us, meanings, examples = dictionary_data(entry)
            if br or us:
                with_phonetics += 1
            if meanings:
                with_meanings += 1
            chinese = "；".join(f"{item['partOfSpeech']}. {item['text']}" for item in meanings)
            output.execute(
                "INSERT INTO words(english,english_normalized,phonetic,chinese,phonetic_br,phonetic_us,meanings_json,examples_json) VALUES(?,?,?,?,?,?,?,?)",
                (word, normalize(word), br or us, chinese, br, us, json.dumps(meanings, ensure_ascii=False), json.dumps(examples, ensure_ascii=False)),
            )
        metadata = {
            "name": "NCEE Vocabulary Database", "full_name": "National College Entrance Examination Vocabulary Database",
            "headword_source": str(args.source.resolve()), "content_source": "oxford10c",
            "dictionary_path": str(args.dictionary.resolve()), "word_count": str(len(words)),
            "matched_count": str(matched), "meaning_count": str(with_meanings),
            "phonetic_count": str(with_phonetics), "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        output.executemany("INSERT INTO metadata(key,value) VALUES(?,?)", metadata.items())
        output.commit()
        output.execute("PRAGMA optimize")
        output.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        output.execute("PRAGMA journal_mode=DELETE")
    finally:
        dictionary.close()
        output.close()
    print(f"Created {args.output}: {len(words)} words, {matched} matched, {with_meanings} with meanings, {with_phonetics} with phonetics.")


if __name__ == "__main__":
    main()

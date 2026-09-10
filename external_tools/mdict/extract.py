from __future__ import annotations

import argparse
import json
import os
import sqlite3
import time
import traceback
from pathlib import Path
from typing import Any

from mdict_utils.base.readmdict import MDX

from parser import parse_entry


DEFAULT_MDX = Path("dicts/oxford-10-en2cn.mdx")
DEFAULT_DB = Path("dicts/oxford-10-en2cn-api.sqlite3")
SCHEMA_VERSION = "1"


def decode(value: bytes | str) -> str:
    return value.decode("utf-8", errors="replace") if isinstance(value, bytes) else str(value)


def normalize_lookup(value: str | None) -> str:
    return " ".join((value or "").strip().casefold().split())


def json_value(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE entries(
 id INTEGER PRIMARY KEY, lookup_key TEXT NOT NULL, source_key TEXT NOT NULL,
 display_word TEXT, pronunciation_br TEXT, pronunciation_us TEXT,
 labels_json TEXT NOT NULL, forms_json TEXT NOT NULL, entry_json TEXT NOT NULL,
 raw_html TEXT
);
CREATE INDEX entries_lookup_idx ON entries(lookup_key);
CREATE INDEX entries_source_idx ON entries(source_key COLLATE NOCASE);
CREATE TABLE aliases(
 alias_key TEXT NOT NULL, alias_source TEXT NOT NULL,
 target_key TEXT NOT NULL, target_source TEXT NOT NULL,
 PRIMARY KEY(alias_key,target_key,alias_source)
) WITHOUT ROWID;
CREATE INDEX aliases_target_idx ON aliases(target_key);
CREATE TABLE sense_groups(
 id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
 group_index INTEGER NOT NULL, pos TEXT, title_en TEXT, title_zh TEXT,
 UNIQUE(entry_id,group_index)
);
CREATE INDEX sense_groups_entry_idx ON sense_groups(entry_id,group_index);
CREATE TABLE phrases(
 id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
 phrase_index INTEGER NOT NULL, phrase_key TEXT NOT NULL, type TEXT NOT NULL,
 lookup_phrase TEXT NOT NULL, display_phrase TEXT, labels_json TEXT NOT NULL,
 UNIQUE(entry_id,phrase_index)
);
CREATE INDEX phrases_entry_idx ON phrases(entry_id,phrase_index);
CREATE INDEX phrases_lookup_idx ON phrases(lookup_phrase);
CREATE TABLE senses(
 id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
 phrase_id INTEGER REFERENCES phrases(id) ON DELETE CASCADE,
 group_id INTEGER REFERENCES sense_groups(id) ON DELETE SET NULL,
 sense_index INTEGER NOT NULL, sense_key TEXT NOT NULL, sense_number TEXT, pos TEXT,
 definition_en TEXT, definition_zh TEXT, grammar_json TEXT NOT NULL,
 registers_json TEXT NOT NULL, patterns_json TEXT NOT NULL, labels_json TEXT NOT NULL
);
CREATE INDEX senses_entry_idx ON senses(entry_id,phrase_id,sense_index);
CREATE INDEX senses_group_idx ON senses(group_id);
CREATE TABLE examples(
 id INTEGER PRIMARY KEY, sense_id INTEGER NOT NULL REFERENCES senses(id) ON DELETE CASCADE,
 example_index INTEGER NOT NULL, en TEXT, zh TEXT,
 labels_json TEXT NOT NULL, glosses_json TEXT NOT NULL,
 UNIQUE(sense_id,example_index)
);
CREATE INDEX examples_sense_idx ON examples(sense_id,example_index);
CREATE TABLE sense_references(
 id INTEGER PRIMARY KEY, sense_id INTEGER NOT NULL REFERENCES senses(id) ON DELETE CASCADE,
 reference_index INTEGER NOT NULL, type TEXT NOT NULL, target_key TEXT,
 display_target TEXT, pos TEXT, UNIQUE(sense_id,reference_index)
);
CREATE INDEX references_sense_idx ON sense_references(sense_id,reference_index);
CREATE INDEX references_target_idx ON sense_references(target_key);
CREATE TABLE notes(
 id INTEGER PRIMARY KEY, sense_id INTEGER NOT NULL REFERENCES senses(id) ON DELETE CASCADE,
 note_index INTEGER NOT NULL, type TEXT NOT NULL, text TEXT NOT NULL,
 UNIQUE(sense_id,note_index)
);
CREATE INDEX notes_sense_idx ON notes(sense_id,note_index);
CREATE TABLE failed_entries(
 id INTEGER PRIMARY KEY, source_key TEXT NOT NULL, error TEXT NOT NULL, traceback TEXT
);
CREATE VIRTUAL TABLE entry_search USING fts5(
 lookup_key, display_word, definitions_en, definitions_zh, content=''
);
"""


def create_database(db: sqlite3.Connection, include_raw_html: bool) -> None:
    db.executescript(SCHEMA)
    db.executemany(
        "INSERT INTO metadata VALUES (?,?)",
        [("schema_version", SCHEMA_VERSION),
         ("created_at_unix", str(int(time.time()))),
         ("raw_html_included", str(int(include_raw_html)))],
    )


def insert_sense(
    db: sqlite3.Connection, entry_id: int, phrase_id: int | None,
    group_id: int | None, index: int, sense: dict[str, Any],
) -> None:
    cursor = db.execute(
        """INSERT INTO senses(entry_id,phrase_id,group_id,sense_index,sense_key,
        sense_number,pos,definition_en,definition_zh,grammar_json,registers_json,
        patterns_json,labels_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (entry_id, phrase_id, group_id, index, sense.get("key", ""), sense.get("number"),
         sense.get("pos"), sense.get("definition_en"), sense.get("definition_zh"),
         json_value(sense.get("grammar", [])), json_value(sense.get("registers", [])),
         json_value(sense.get("patterns", [])), json_value(sense.get("labels", {}))),
    )
    sense_id = int(cursor.lastrowid)
    db.executemany(
        """INSERT INTO examples(sense_id,example_index,en,zh,labels_json,glosses_json)
        VALUES (?,?,?,?,?,?)""",
        [(sense_id, i, item.get("en"), item.get("zh"),
          json_value(item.get("labels", [])), json_value(item.get("glosses", [])))
         for i, item in enumerate(sense.get("examples", []))],
    )
    db.executemany(
        """INSERT INTO sense_references(sense_id,reference_index,type,target_key,
        display_target,pos) VALUES (?,?,?,?,?,?)""",
        [(sense_id, i, item.get("type", "reference"), normalize_lookup(item.get("target")),
          item.get("display_target"), item.get("pos"))
         for i, item in enumerate(sense.get("refs", []))],
    )
    db.executemany(
        "INSERT INTO notes(sense_id,note_index,type,text) VALUES (?,?,?,?)",
        [(sense_id, i, item.get("type", "note"), item["text"])
         for i, item in enumerate(sense.get("notes", [])) if item.get("text")],
    )


def insert_entry(
    db: sqlite3.Connection, source_key: str, html: str, include_raw_html: bool,
) -> None:
    data = parse_entry(html, source_key=source_key)
    pronunciation = data.get("pronunciation", {})
    cursor = db.execute(
        """INSERT INTO entries(lookup_key,source_key,display_word,pronunciation_br,
        pronunciation_us,labels_json,forms_json,entry_json,raw_html)
        VALUES (?,?,?,?,?,?,?,?,?)""",
        (normalize_lookup(source_key), source_key, data.get("display_word"),
         pronunciation.get("br"), pronunciation.get("us"),
         json_value(data.get("labels", {})), json_value(data.get("forms", [])),
         json_value(data), html if include_raw_html else None),
    )
    entry_id = int(cursor.lastrowid)
    group_ids: dict[str, int] = {}
    for i, group in enumerate(data.get("sense_groups", [])):
        row = db.execute(
            "INSERT INTO sense_groups(entry_id,group_index,pos,title_en,title_zh) VALUES (?,?,?,?,?)",
            (entry_id, i, group.get("pos"), group.get("title_en"), group.get("title_zh")),
        )
        for key in group.get("sense_keys", []):
            group_ids[key] = int(row.lastrowid)

    definitions_en: list[str] = []
    definitions_zh: list[str] = []
    for i, sense in enumerate(data.get("senses", [])):
        definitions_en.extend([sense["definition_en"]] if sense.get("definition_en") else [])
        definitions_zh.extend([sense["definition_zh"]] if sense.get("definition_zh") else [])
        insert_sense(db, entry_id, None, group_ids.get(sense.get("key", "")), i, sense)

    for i, phrase in enumerate(data.get("phrases", [])):
        row = db.execute(
            """INSERT INTO phrases(entry_id,phrase_index,phrase_key,type,lookup_phrase,
            display_phrase,labels_json) VALUES (?,?,?,?,?,?,?)""",
            (entry_id, i, phrase.get("key", ""), phrase.get("type", "phrase"),
             normalize_lookup(phrase.get("phrase")), phrase.get("display_phrase"),
             json_value(phrase.get("labels", {}))),
        )
        for j, sense in enumerate(phrase.get("senses", [])):
            definitions_en.extend([sense["definition_en"]] if sense.get("definition_en") else [])
            definitions_zh.extend([sense["definition_zh"]] if sense.get("definition_zh") else [])
            insert_sense(db, entry_id, int(row.lastrowid), None, j, sense)

    db.execute(
        "INSERT INTO entry_search(rowid,lookup_key,display_word,definitions_en,definitions_zh) VALUES (?,?,?,?,?)",
        (entry_id, normalize_lookup(source_key), data.get("display_word"),
         "\n".join(definitions_en), "\n".join(definitions_zh)),
    )


def build_database(args: argparse.Namespace) -> None:
    if not args.mdx.is_file():
        raise SystemExit(f"MDX file not found: {args.mdx}")
    if args.output.exists() and not args.force:
        raise SystemExit(f"Output exists: {args.output}; pass --force to replace it")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_name(args.output.name + ".tmp")
    temporary.unlink(missing_ok=True)
    db = sqlite3.connect(temporary)
    started = time.monotonic()
    records = entries = aliases = failed = 0
    try:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA synchronous=NORMAL")
        db.execute("PRAGMA temp_store=MEMORY")
        create_database(db, args.include_raw_html)
        db.commit()
        db.execute("BEGIN")
        for records, (raw_key, raw_value) in enumerate(MDX(str(args.mdx)).items(), 1):
            if args.limit and records > args.limit:
                records -= 1
                break
            key, value = decode(raw_key).strip(), decode(raw_value).strip()
            if not key:
                continue
            try:
                if value.startswith("@@@LINK="):
                    target = value.removeprefix("@@@LINK=").strip()
                    cursor = db.execute(
                        "INSERT OR IGNORE INTO aliases VALUES (?,?,?,?)",
                        (normalize_lookup(key), key, normalize_lookup(target), target),
                    )
                    aliases += cursor.rowcount
                else:
                    insert_entry(db, key, value, args.include_raw_html)
                    entries += 1
            except Exception as error:
                failed += 1
                db.execute("INSERT INTO failed_entries(source_key,error,traceback) VALUES (?,?,?)",
                           (key, str(error), traceback.format_exc()))
            if records % args.commit_interval == 0:
                db.commit()
                db.execute("BEGIN")
                print(f"\rrecords={records:,} entries={entries:,} aliases={aliases:,} failed={failed:,}",
                      end="", flush=True)
        db.commit()
        db.executemany("INSERT INTO metadata VALUES (?,?)",
                       [("record_count", str(records)), ("entry_count", str(entries)),
                        ("alias_count", str(aliases)), ("failed_count", str(failed))])
        db.execute("ANALYZE")
        db.execute("PRAGMA optimize")
        db.commit()
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("SQLite integrity check failed")
        db.close()
        args.output.unlink(missing_ok=True)
        os.replace(temporary, args.output)
    except BaseException:
        db.close()
        temporary.unlink(missing_ok=True)
        raise
    print(f"\nCreated {args.output}: records={records:,}, entries={entries:,}, "
          f"aliases={aliases:,}, failed={failed:,}, elapsed={time.monotonic()-started:.1f}s")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert Oxford MDX to a Node.js-friendly SQLite DB")
    parser.add_argument("--mdx", type=Path, default=DEFAULT_MDX)
    parser.add_argument("--output", type=Path, default=DEFAULT_DB)
    parser.add_argument("--include-raw-html", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--commit-interval", type=int, default=500)
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be greater than zero")
    if args.commit_interval < 1:
        parser.error("--commit-interval must be greater than zero")
    return args


if __name__ == "__main__":
    build_database(parse_args())

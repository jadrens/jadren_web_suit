# Oxford MDX to SQLite

Build the database used by the Node.js HTTP API:

```bash
UV_CACHE_DIR=/tmp/mdict-uv-cache uv run python extract.py
```

The default output is `dicts/oxford-10-en2cn-api.sqlite3`. Existing output is
protected; pass `--force` to replace it. Use `--limit 500` for a quick test and
`--include-raw-html` only when the API needs the original dictionary HTML.

## API-oriented schema

- `entries`: exact lookup fields, pronunciation, forms, labels, and the complete
  parsed response in `entry_json`. A normal dictionary endpoint can return this
  JSON directly.
- `aliases`: redirects inflected/alternative spellings to canonical lookup keys.
- `sense_groups`, `senses`, `examples`: ordered relational representation of
  definitions and examples.
- `phrases`: idioms and phrasal verbs, linked to their rows in `senses`.
- `sense_references`, `notes`: cross-entry links and usage notes.
- `entry_search`: FTS5 index across words and English/Chinese definitions.
- `metadata`, `failed_entries`: schema/build information and import diagnostics.

Exact lookup with alias fallback:

```sql
SELECT entry_json
FROM entries
WHERE lookup_key = lower(trim(?))
ORDER BY id
LIMIT 1;

SELECT target_key
FROM aliases
WHERE alias_key = lower(trim(?))
ORDER BY target_key
LIMIT 1;
```

Prefix suggestions and full-text search:

```sql
SELECT display_word FROM entries
WHERE lookup_key >= ? AND lookup_key < ? || char(0x10ffff)
ORDER BY lookup_key LIMIT 20;

SELECT e.entry_json
FROM entry_search AS f
JOIN entries AS e ON e.id = f.rowid
WHERE entry_search MATCH ?
LIMIT 20;
```

# Dictionary API: oxford10c

The API reads the bundled SQLite database in read-only/query-only mode. It is
public and does not require authentication.

By default the server opens `.data/database/oxford-10-en2cn.sqlite3`, relative to the
application working directory. Set `OXFORD_DICTIONARY_DB` to an absolute path
or another application-relative path when deploying the database elsewhere.

## Exact lookup

`POST /rpc/jadren.v1.DictionaryService/Lookup` with `{ "word": "<word-or-phrase>", "direction": "auto|en-zh|zh-en" }`

Lookup is case-insensitive, collapses repeated whitespace, and automatically
follows dictionary aliases such as plural forms. The input limit is 120
printable characters. `direction` defaults to `auto`, which detects Chinese
characters and performs a Chinese-definition-to-English lookup automatically.

```bash
curl -s http://localhost:3000/rpc/jadren.v1.DictionaryService/Lookup -H 'Content-Type: application/json' -d '{"word":"come to"}'
curl -s http://localhost:3000/rpc/jadren.v1.DictionaryService/Lookup -H 'Content-Type: application/json' -d '{"word":"apples"}'
curl -s http://localhost:3000/rpc/jadren.v1.DictionaryService/Lookup -H 'Content-Type: application/json' -d '{"word":"苹果"}'
```

Successful response (the document is wrapped in `result`):

```json
{
 "result": {
  "query": "apples",
  "lookupKey": "apples",
  "resolvedKey": "apple",
  "isAlias": true,
  "entry": {
    "word": "apple",
    "display_word": "apple",
    "pronunciation": { "br": "/ˈæpl/", "us": "/ˈæpl/" },
    "labels": {},
    "forms": [],
    "sense_groups": [],
    "senses": [],
    "phrases": [],
    "warnings": []
  }
 }
}
```

`entry` is the complete parser result; the abbreviated arrays above are only
for illustrating its shape. `come to` is represented as a phrase entry and may
therefore have an empty top-level `senses` array with data under `phrases`.

Errors use the Connect error shape `{ "code", "message", "details" }`; the application code is `details[0].debug.code` in JSON:

- `400 invalid_argument` / `invalid_word`: missing, too long, or contains control characters.
- `404 not_found` / `word_not_found`: neither an entry nor a resolvable alias exists.
- `503 unavailable` / `dictionary_unavailable`: database missing, unreadable, or invalid.

## Prefix suggestions

`POST /rpc/jadren.v1.DictionaryService/Search` with `{ "query": "<prefix>", "limit": 1..50, "direction": "auto|en-zh|zh-en" }`

`limit` defaults to 20. Results include both canonical entries and aliases, so
the UI can display the spelling entered by users while retaining its target.
`direction` defaults to `auto`: queries containing Chinese characters use
Chinese-to-English search, and other queries use English prefix search. In
`zh-en` mode, results are ranked English entries whose Chinese definitions
match the query, and each result can include a `meaning` field containing the
matching Chinese definition.

```bash
curl -s http://localhost:3000/rpc/jadren.v1.DictionaryService/Search -H 'Content-Type: application/json' -d '{"query":"come t","limit":10}'
curl -s http://localhost:3000/rpc/jadren.v1.DictionaryService/Search -H 'Content-Type: application/json' -d '{"query":"苹果","limit":10,"direction":"zh-en"}'
```

```json
{
  "query": "come t",
  "count": 2,
  "results": [
    {
      "word": "come to",
      "lookupKey": "come to",
      "isAlias": false,
      "target": null
    }
  ]
}
```

Both methods are side-effect free and also accept the Connect `GET` form. Cache headers (five minutes / one day for lookups, one minute / one hour for suggestions) only take effect for `GET`; `POST` responses are not cached. The SQLite connection is reused across requests and never opened with
write permissions.

# Dictionary API: oxford10c

The API reads the bundled SQLite database in read-only/query-only mode. It is
public and does not require authentication.

By default the server opens `database/oxford-10-en2cn.sqlite3`, relative to the
application working directory. Set `OXFORD_DICTIONARY_DB` to an absolute path
or another application-relative path when deploying the database elsewhere.

## Exact lookup

`GET /api/dictionary/oxford10c?word=<word-or-phrase>`

Lookup is case-insensitive, collapses repeated whitespace, and automatically
follows dictionary aliases such as plural forms. The input limit is 120
printable characters.

```bash
curl 'http://localhost:3000/api/dictionary/oxford10c?word=come%20to'
curl 'http://localhost:3000/api/dictionary/oxford10c?word=apples'
```

Successful response:

```json
{
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
```

`entry` is the complete parser result; the abbreviated arrays above are only
for illustrating its shape. `come to` is represented as a phrase entry and may
therefore have an empty top-level `senses` array with data under `phrases`.

Errors use `{ "code": string, "error": string }`:

- `400 invalid_word`: missing, too long, or contains control characters.
- `404 word_not_found`: neither an entry nor a resolvable alias exists.
- `503 dictionary_unavailable`: database missing, unreadable, or invalid.

## Prefix suggestions

`GET /api/dictionary/oxford10c/search?q=<prefix>&limit=<1..50>`

`limit` defaults to 20. Results include both canonical entries and aliases, so
the UI can display the spelling entered by users while retaining its target.

```bash
curl 'http://localhost:3000/api/dictionary/oxford10c/search?q=come%20t&limit=10'
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

Exact responses cache for five minutes in browsers and one day in shared
caches. Suggestions cache for one minute in browsers and one hour in shared
caches. The SQLite connection is reused across requests and never opened with
write permissions.

## Quick start

Both endpoints return public JSON responses and require no authentication or API key. Use your site's origin; examples below use the local development server.

```bash
curl 'http://localhost:3000/api/dictionary/oxford10c?word=apple'
```

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

### Exact lookup errors

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
  "count": 1,
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

No matches return `200` with `count: 0` and an empty `results` array. `count` is the number of returned suggestions. `word` is the display spelling; use `lookupKey` for exact lookup. For an alias, `target` identifies its canonical entry.

## JavaScript example

```javascript
async function lookupWord(word) {
  const params = new URLSearchParams({ word });
  const response = await fetch(`/api/dictionary/oxford10c?${params}`);
  const data = await response.json();
  if (!response.ok) throw new Error(`${data.code}: ${data.error}`);
  return data.entry;
}

const entry = await lookupWord("come to");
console.log(entry.senses, entry.phrases);
```

## Response fields

| Field | Meaning |
| --- | --- |
| `query` | Input with leading and trailing whitespace removed |
| `lookupKey` | Normalized lookup key |
| `resolvedKey` | Entry key after resolving aliases |
| `isAlias` | Whether alias resolution was used |
| `entry.word` / `entry.display_word` | Word and display spelling |
| `entry.pronunciation` | British `br` and American `us` pronunciations |
| `entry.labels` / `entry.forms` | Labels and word forms |
| `entry.sense_groups` / `entry.senses` | Sense groups and top-level senses, including definitions and examples |
| `entry.phrases` | Phrases and idioms with their senses |
| `entry.warnings` | Parser warnings |

Fields can be absent or empty. Always check both `senses` and `phrases` when displaying definitions.

## Suggestion errors

Errors use the same `{ code, error }` shape as exact lookups.

| HTTP status | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_query` | Missing, too long, or control characters in `q` |
| 400 | `invalid_limit` | `limit` is not an integer between 1 and 50 |
| 503 | `dictionary_unavailable` | Dictionary database unavailable |

## Caching

Successful exact responses cache for five minutes in browsers and one day in shared
caches. Suggestions cache for one minute in browsers and one hour in shared
caches.

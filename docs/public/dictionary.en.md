## Quick start

Both methods are public [Connect](https://connectrpc.com/) RPCs (`jadren.v1.DictionaryService`) and require no authentication or API key. Send a `POST` with a JSON body and `Content-Type: application/json`; the response is plain JSON. gRPC-Web and binary Protobuf clients work as well. Use your site's origin; examples below use the local development server.

```bash
curl -s http://localhost:3000/rpc/jadren.v1.DictionaryService/Lookup -H 'Content-Type: application/json' -d '{"word":"apple"}'
```

## Exact lookup

`POST /rpc/jadren.v1.DictionaryService/Lookup` with `{ "word": "<word-or-phrase>" }`

Lookup is case-insensitive, collapses repeated whitespace, and automatically
follows dictionary aliases such as plural forms. The input limit is 120
printable characters.

```bash
curl -s http://localhost:3000/rpc/jadren.v1.DictionaryService/Lookup -H 'Content-Type: application/json' -d '{"word":"come to"}'
curl -s http://localhost:3000/rpc/jadren.v1.DictionaryService/Lookup -H 'Content-Type: application/json' -d '{"word":"apples"}'
```

Successful response (the dictionary document is wrapped in `result`):

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

### Exact lookup errors

Errors use the Connect error shape `{ "code": string, "message": string, "details": [...] }`. The HTTP status follows the Connect code, and the application code (for example `word_not_found`) is carried in a `jadren.v1.ErrorDetail` entry of `details` (readable as `details[0].debug.code` in JSON):

- `400 invalid_argument` / `invalid_word`: missing, too long, or contains control characters.
- `404 not_found` / `word_not_found`: neither an entry nor a resolvable alias exists.
- `503 unavailable` / `dictionary_unavailable`: database missing, unreadable, or invalid.

## Prefix suggestions

`POST /rpc/jadren.v1.DictionaryService/Search` with `{ "query": "<prefix>", "limit": 1..50 }`

`limit` defaults to 20. Results include both canonical entries and aliases, so
the UI can display the spelling entered by users while retaining its target.

```bash
curl -s http://localhost:3000/rpc/jadren.v1.DictionaryService/Search -H 'Content-Type: application/json' -d '{"query":"come t","limit":10}'
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
  const response = await fetch("/rpc/jadren.v1.DictionaryService/Lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${data.code}: ${data.message}`);
  return data.result.entry;
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

Errors use the same Connect error shape as exact lookups; the table shows the HTTP status and the application code in `details`.

| HTTP status | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_query` | Missing, too long, or control characters in `q` |
| 400 | `invalid_limit` | `limit` is not an integer between 1 and 50 |
| 503 | `dictionary_unavailable` | Dictionary database unavailable |

## Caching

Both methods are side-effect free, so they also accept the Connect `GET` form, for example `GET /rpc/jadren.v1.DictionaryService/Lookup?connect=v1&encoding=json&message=%7B%22word%22%3A%22apple%22%7D`. Successful exact responses carry cache headers for five minutes in browsers and one day in shared caches; suggestions for one minute and one hour. The headers only help when clients use the `GET` form, because `POST` responses are not cached.

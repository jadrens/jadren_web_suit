# RPC API

All server interfaces are Protobuf services. The schema lives in
`proto/jadren/v1/*.proto`; there are no REST routes under `/api` any more.

## Transport

Next.js route handlers cannot expose HTTP/2 trailers, so native gRPC (the
`application/grpc` wire format) is not served. Every service is available on
one endpoint through the protocols that work over plain HTTP:

```
POST /rpc/<package.Service>/<Method>
```

- **Connect** (default for the browser client): binary Protobuf
  (`application/proto`) or JSON (`application/json`). Methods marked
  `NO_SIDE_EFFECTS` also accept `GET`.
- **gRPC-Web**: `application/grpc-web+proto`. Clients that need native gRPC can
  put an Envoy/`grpcwebproxy` in front.

The handlers are assembled in `src/lib/rpc/server/router.ts` and mounted by
`src/app/rpc/[service]/[method]/route.ts`.

```bash
curl -s http://localhost:3000/rpc/jadren.v1.AuthService/Login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"dragonren","password":"..."}'
```

## Authentication

Send `Authorization: Bearer <jwt>` as request metadata. See
[`auth-api.md`](auth-api.md) for how tokens are issued and refreshed.

## Errors

Failures use the standard gRPC status codes and, in Connect JSON, the shape
`{ code, message, details }`. The stable application code
(`invalid_credentials`, `quick_link_exists`, ...) is a `jadren.v1.ErrorDetail`
in `details` (`details[0].debug.code` in JSON). The REST status codes map to
RPC codes as follows:

| REST | RPC code |
| --- | --- |
| 400, 422 | `INVALID_ARGUMENT` |
| 401 | `UNAUTHENTICATED` |
| 403 | `PERMISSION_DENIED` |
| 404 | `NOT_FOUND` |
| 409 | `ALREADY_EXISTS` |
| 429 | `RESOURCE_EXHAUSTED` |
| 502, 503 | `UNAVAILABLE` |
| 500 | `INTERNAL` |

## Services

| Service | Proto | Replaces |
| --- | --- | --- |
| `AuthService` | `auth.proto` | `/api/auth/*`, `/api/editor/login` |
| `QuickLinkService` | `account.proto` | `/api/quick-links` |
| `ReminderService` | `account.proto` | `/api/reminders` |
| `LlmSettingsService` | `account.proto` | `/api/llm-settings` |
| `SentencePracticeService` | `vocabulary.proto` | `/api/vocabulary-practice` |
| `VocabularyDrillService` | `vocabulary.proto` | `/api/vocabulary-drill/*` |
| `DictionaryService` | `tools.proto` | `/api/dictionary/oxford10c*` |
| `ToolsService` | `tools.proto` | `/api/ip`, `/api/ip-geo`, `/api/dns`, `/api/dns-leak`, `/api/tts/pronunciation`, `/api/search` |
| `EditorService` | `publishing.proto` | `/api/editor/*` |
| `AdminService` | `publishing.proto` | `/api/admin/*` |

Schemaless documents (dictionary entries, IP geolocation, blog search results)
are `google.protobuf.Struct`, which is plain JSON in the Connect JSON protocol.

## Code generation

`src/gen` is generated and committed. After editing a `.proto` file run:

```bash
bun run proto:generate   # protoc + @bufbuild/protoc-gen-es
```

`protoc` must be installed locally; the plugin comes from `node_modules`.

## Adding a method

1. Add the RPC and messages to the `.proto` file and regenerate.
2. Implement it in `src/lib/rpc/server/services/*.ts`. Throw
   `apiFailure(message, httpStatus, applicationCode)` for expected failures;
   any other exception is logged and returned as `INTERNAL`.
3. Expose it to the UI from `src/lib/client-api/index.ts`, converting messages
   with `mappers.ts`.

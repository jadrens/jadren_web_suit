# RPC API

All server interfaces are Protobuf services. The schema lives in
`proto/jadren/v1/*.proto`; there are no REST routes under `/api` any more.

## Transport

The browser multiplexes binary Protobuf RPCs over a single same-origin
WebSocket at `/rpc/ws`, using the `jadren.rpc.v1` subprotocol. Authentication
metadata, method paths, and request IDs travel in each call. Tokens remain
per-call, so a refreshed token or account change does not require a new socket.

`Login`, `Register`, `ResetPassword`, `Refresh`, and `Logout` use HTTP because
they set or clear the HttpOnly refresh cookie. The WebSocket endpoint rejects
these methods and never accepts or returns cookies in frames. Other auth methods,
including `Me` and email-code requests, use the WebSocket.

The client connects lazily, supports concurrent calls and cancellation, and
retains the 15-second per-call deadline. Disconnects fail pending calls without
replaying them; the next call opens a fresh socket. An `UNAUTHENTICATED` response
can still trigger the existing single refresh/retry.

### Server and deployment

Start with `bun run dev` or `bun run start` (production). These run
`scripts/server.ts`, which hosts Next.js and the WebSocket gateway on the same
port. Running `next dev` or `next start` directly bypasses the gateway.
The gateway dispatches over HTTP/1.1 loopback to the existing Next route handlers,
preserving Next's request context, caching, and publishing revalidation.
No extra public port or service is needed.

The nginx proxy must forward `Upgrade` and `Connection` headers; both supplied
nginx examples support this. The gateway sends pings every 25 seconds and rejects
origins that do not match the public scheme and Host. Behind TLS termination,
forward the public scheme as `X-Forwarded-Proto`. Client IP headers are copied
from the upgrade request, never from frame metadata.

### WebSocket framing

Each binary WebSocket message contains a four-byte big-endian JSON-header length,
that many UTF-8 JSON bytes, and the raw Protobuf body. Headers are limited to
16 KiB, bodies to 8 MiB, and concurrent calls to 64 per socket.

```json
{"type":"request","id":"1","path":"/rpc/jadren.v1.ToolsService/GetClientIp","headers":[["content-type","application/proto"],["connect-protocol-version","1"]]}
{"type":"response","id":"1","status":200,"headers":[["content-type","application/proto"]]}
{"type":"cancel","id":"1"}
```

Cancel messages have no body. Success responses carry Protobuf bytes; failures
carry the usual Connect JSON error body and status. Unsupported streaming methods
are not part of this unary transport; all current service methods are unary.

### HTTP compatibility

Every service remains available to external clients at:

```
POST /rpc/<package.Service>/<Method>
```

- **Connect**: binary Protobuf
  (`application/proto`) or JSON (`application/json`). Methods marked
  `NO_SIDE_EFFECTS` also accept `GET`.
- **gRPC-Web**: `application/grpc-web+proto`. Clients that need native gRPC can
  put an Envoy/`grpcwebproxy` in front.

Native gRPC (`application/grpc`, requiring HTTP/2 trailers) is not served.
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

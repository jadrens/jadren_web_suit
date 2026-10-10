# Client API and authentication lifecycle

The client foundation lives in `src/lib/client-api`. `AuthLifecycle` is mounted
in the root layout, so a stored session is restored as soon as the browser app
hydrates.

## RPC clients

The browser talks to the server with [Connect](https://connectrpc.com/) RPCs
over `/rpc` (see [`rpc-api.md`](rpc-api.md)). `src/lib/client-api/rpc.ts`
builds the typed service clients; `index.ts` wraps them in the per-feature
objects the UI uses (`quickLinksApi`, `remindersApi`, `vocabularyDrillApi`,
`dictionaryApi`, `toolsApi`, `editorApi`, ...) and `mappers.ts` converts
Protobuf messages into the plain types in `types.ts`.

An interceptor attaches the current Bearer token. On `UNAUTHENTICATED` it
deduplicates token refresh work and retries the original call once.

```ts
import { quickLinksApi } from "@lib/client-api";

const { links } = await quickLinksApi.list();
await quickLinksApi.create({
  shortName: "docs",
  targetUrl: "https://example.com",
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
});
```

Calls time out after 15 seconds. Pass `{ signal }` (where a wrapper accepts
call options) to cancel. Failed calls throw `ApiError`, which contains
`status` (the HTTP status equivalent of the RPC status code), `code` (the
application code such as `invalid_credentials`), and `url`.

## Authentication methods

```ts
import { authSession } from "@/lib/client-api";

await authSession.register({
  nickname: "dragonren",
  email: "user@example.com",
  password: "a-secure-password",
});

await authSession.login({
  identifier: "dragonren",
  password: "a-secure-password",
});

await authSession.sendVerificationCode("user@example.com", "en");
await authSession.verifyEmail("user@example.com", "123456");
await authSession.loadCurrentUser();
authSession.logout();
```

All existing auth endpoints have request and response types in `types.ts`.

## React state

```tsx
"use client";

import { useAuth } from "@/lib/client-api/use-auth";

export function AccountButton() {
  const { status, user, isAuthenticated, login, logout } = useAuth();

  if (status === "uninitialized") return null;
  if (!isAuthenticated) return <button onClick={() => void login(/* ... */)}>Login</button>;
  return <button onClick={logout}>Logout {user?.nickname}</button>;
}
```

## Lifecycle behavior

- The access token and public user profile are persisted in `localStorage`.
- The token is refreshed one minute before its one-day expiration.
- Expired access tokens remain refreshable inside the server-provided 16-day
  window.
- Concurrent refresh requests share one promise.
- Browser tabs synchronize login and logout through the `storage` event.
- Returning online or foregrounding the page triggers a refresh when needed.
- An `UNAUTHENTICATED` response refreshes and retries only once, preventing retry loops.
- A refresh rejected with `401` or `403` clears the session immediately.

Because the backend deliberately uses stateless Bearer JWTs instead of secure
cookies, persistent login uses `localStorage`. Client code must avoid unsafe
HTML injection because any XSS vulnerability could expose that token.

## Standalone account pages

- `/register` creates an account, attempts to send the first verification code,
  and continues to `/verify-email`.
- `/verify-email` sends and verifies six-digit email codes, with a client-side
  resend cooldown in addition to the server SQLite rate limiter.
- `/login` accepts nickname or email and supports a safe same-origin `next`
  query parameter.

These routes are intentionally absent from the main navigation and sitemap.

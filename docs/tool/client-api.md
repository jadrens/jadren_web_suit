# Client API and authentication lifecycle

The client foundation lives in `src/lib/client-api`. `AuthLifecycle` is mounted
in the root layout, so a stored session is restored as soon as the browser app
hydrates.

## RPC clients

The browser sends binary Protobuf RPCs over one multiplexed WebSocket at
`/rpc/ws` (see [`rpc-api.md`](rpc-api.md)). The Connect client handles schemas,
interceptors, and errors; `websocket-fetch.ts` carries calls over the socket.
The five auth methods that set or clear HttpOnly cookies retain HTTP transport.
`src/lib/client-api/rpc.ts`
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
Canceled calls also cancel server dispatch. A dropped socket fails its pending
calls without replay; a subsequent call reconnects. Existing account guards
continue to reject responses and retries belonging to a previous account.

## Authentication methods

```ts
import { authSession } from "@/lib/client-api";

// Sign-up proves the email first; register() then signs the new user in.
await authSession.sendRegistrationCode("user@example.com", "en");
await authSession.register({
  nickname: "", // optional: defaults to the email's local part
  email: "user@example.com",
  password: "a-secure-password",
  code: "123456",
});

await authSession.login({
  identifier: "dragonren",
  password: "a-secure-password",
});

await authSession.sendPasswordResetCode("user@example.com", "en");
await authSession.resetPassword("user@example.com", "123456", "a-new-password");

await authSession.sendVerificationCode("user@example.com", "en");
await authSession.verifyEmail("user@example.com", "123456");
await authSession.loadCurrentUser();
await authSession.logout();
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

- The 15-minute access token and the public user profile are kept in
  `localStorage`. The refresh token is an `HttpOnly` cookie that scripts cannot
  read; only the auth service receives it.
- The access token is refreshed one minute before it expires, and again on
  demand after an expired token.
- Refreshing is possible until the session ends, 30 days after sign-in
  (`refreshWindow`). After that the user signs in again.
- Concurrent refresh requests share one promise.
- Browser tabs synchronize login and logout through the `storage` event.
- Returning online or foregrounding the page triggers a refresh when needed.
- An `UNAUTHENTICATED` response refreshes and retries only once, preventing retry loops.
- A refresh rejected with `401` or `403` clears the session immediately.
- `logout()` clears local state immediately, then revokes the session on the server.

An XSS bug could still read the short-lived access token, but not the refresh
token, so a stolen session ends within 15 minutes of the attacker losing
access. Client code must still avoid unsafe HTML injection.

## Standalone account pages

- `/register` collects the account details, sends a code to the email, and
  creates the verified account once the code is entered.
- `/reset-password` sends a reset code and sets a new password; it signs out
  every other session. `/login` links to it.
- `/verify-email` verifies accounts created before sign-up required a code, with a client-side
  resend cooldown in addition to the server SQLite rate limiter.
- `/login` accepts nickname or email and supports a safe same-origin `next`
  query parameter.

These routes are intentionally absent from the main navigation and sitemap.

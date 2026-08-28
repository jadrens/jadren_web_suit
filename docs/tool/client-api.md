# Client API and authentication lifecycle

The client foundation lives in `src/lib/client-api`. `AuthLifecycle` is mounted
in the root layout, so a stored session is restored as soon as the browser app
hydrates.

## Generic requests

`apiClient` automatically attaches the current Bearer token. On HTTP `401`, it
deduplicates token refresh work and retries the original request once.

```ts
import { apiClient } from "@/lib/client-api";

interface ToolItem {
  id: string;
  name: string;
}

const item = await apiClient.get<ToolItem>("/api/items/1");

const created = await apiClient.post<ToolItem, { name: string }>(
  "/api/items",
  { name: "Example" }
);

await apiClient.patch<ToolItem, Partial<ToolItem>>(
  "/api/items/1",
  { name: "Updated" }
);

await apiClient.delete<void>("/api/items/1");
```

The wrapper supports `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and
`OPTIONS`, typed bodies and responses, query parameters, JSON, `FormData`,
custom headers, caller cancellation, and per-request timeouts. Set
`auth: false` for public endpoints. Failed responses throw `ApiError`, which
contains `status`, `url`, and parsed response `details`.

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
- A `401` refreshes and retries only once, preventing retry loops.
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

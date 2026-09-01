# Auth API

All request and response bodies use JSON. JWTs use `HS256` and are accepted through
`Authorization: Bearer <token>`.

Auth errors use a stable machine-readable code plus a short English message:

```json
{
  "code": "invalid_credentials",
  "error_msg": "Invalid credentials",
  "error": "Invalid credentials"
}
```

Clients should translate `code`; `error_msg` is intended for diagnostics.
`error` remains as a compatibility alias.

## Environment

Required:

```dotenv
POSTGRES_USER=dragonren
POSTGRES_PASSWORD=...
POSTGRES_DB=dra_web
POSTGRES_HOST=hzal1.koi.ci
POSTGRES_PORT=5432
POSTGRES_SSL=true
JWT_SECRET=... # at least 32 characters
RESEND_API_KEY=re_...
```

Optional database settings are `POSTGRES_HOST` (default `127.0.0.1`),
`POSTGRES_PORT` (default `5432`), `POSTGRES_SSL=false` to explicitly disable
SSL, or a complete `DATABASE_URL`. SSL is enabled by default.

Run `bun run db:setup` before starting the API. Deployment does this
automatically using Bun.

## Additional tables

`unscrible` stores an email as its primary key and a `scrible` `SMALLINT`
value. PostgreSQL stores `SMALLINT` in two bytes. The value defaults to `0` and
is reserved for future subscription or service-notification state. It has no
foreign key to `user_main`, so it can also represent an email without a user
account.

## Endpoints

### `POST /api/auth/register`

```json
{
  "nickname": "dragonren",
  "email": "user@example.com",
  "password": "at-least-8-characters",
  "phone": null
}
```

Creates a user with `status: 0`. Nickname and email are unique; phone is
optional. Passwords are bcrypt hashes and never returned.

### `POST /api/auth/login`

```json
{
  "identifier": "dragonren",
  "password": "at-least-8-characters"
}
```

`identifier` accepts either nickname or email. Status `0` and `1` can log in;
status `2` is rejected. The response contains `accessToken`, token lifetime
metadata, and the public user object.

Failed attempts are limited in a 15-minute sliding window: eight attempts for
one identifier/IP pair and 30 attempts across all identifiers from one IP.
Successful authentication clears the matching pair. A limited request returns
HTTP `429`, code `login_rate_limit`, and `Retry-After: 900`. The reverse proxy
must overwrite forwarded-IP headers so clients cannot spoof their source IP.

### `GET /api/auth/me`

Validates a non-expired access token without a database lookup and returns its
user claims: ID, nickname, email, phone, registration date, and status.

### `POST /api/auth/refresh`

Accepts the old token as a Bearer token, or as `{ "token": "..." }`. A token
can be refreshed for 16 days from its original issue time, even though its
normal access lifetime is one day. The endpoint reloads the user from the
database and only issues a new token when the current status is `0` or `1`.

### `POST /api/auth/email/send-code`

```json
{ "email": "user@example.com", "locale": "en" }
```

Creates a six-digit code valid for ten minutes. The database stores only its
bcrypt hash. Resend sends the HTML and plain-text verification email from
`auth@jadren.me`. `locale` accepts `en` or `zh` and defaults to English.
A local Bun SQLite database atomically limits each email
to six attempts per three hours and each client IP to 30 attempts per hour.
Either limit returns HTTP `429`. Monitoring rows older than three hours are
deleted automatically.

### `POST /api/auth/email/verify`

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

Consumes a valid, unexpired code and atomically changes the account from
`status: 0` to `status: 1`.

## Stateless-token behavior

Changing a user to status `2` immediately blocks login and token refresh.
Already issued access tokens remain cryptographically valid until their
one-day expiration because there is intentionally no token or revocation table.

# Auth API

Auth is served by `jadren.v1.AuthService` (see [`rpc-api.md`](rpc-api.md) for the
transport). Requests and responses are Protobuf messages defined in
`proto/jadren/v1/auth.proto`; with the Connect protocol they can also be sent as
plain JSON. JWTs use `HS256` and are accepted through
`Authorization: Bearer <token>` metadata.

Failures carry a gRPC status code, a short English message, and a stable
machine-readable application code in a `jadren.v1.ErrorDetail`:

```json
{
  "code": "unauthenticated",
  "message": "Invalid credentials",
  "details": [{ "type": "jadren.v1.ErrorDetail", "debug": { "code": "invalid_credentials" } }]
}
```

Clients should translate the application code (`ApiError.code` in the browser
client); the message is intended for diagnostics.

## Environment

Required:

```dotenv
POSTGRES_USER=app
POSTGRES_PASSWORD=...
POSTGRES_DB=app
POSTGRES_HOST=db.example.com
POSTGRES_PORT=5432
POSTGRES_SSL=true
JWT_SECRET=... # at least 32 characters
MAIL_API_TOKEN=...
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

## Methods

Every method is `POST /rpc/jadren.v1.AuthService/<Method>`.

### `SendRegistrationCode`

```json
{ "email": "user@example.com", "locale": "en" }
```

Mails a six-digit sign-up code to an address that has no verified account yet.
It fails with `duplicate_user` when the email belongs to a verified or banned
account. Sending shares the limits described under `SendVerificationCode`.

### `Register`

```json
{
  "nickname": "dragonren",
  "email": "user@example.com",
  "password": "at-least-8-characters",
  "phone": null,
  "code": "123456"
}
```

Consumes the code from `SendRegistrationCode` and creates a verified user
(`status: 1`), then signs it in: the response is a `TokenResponse` and the
refresh cookie is set. An older unverified account (`status: 0`) with the same
email is deleted in the same transaction, so whoever proves the address owns
it. Nickname and email are unique; phone is optional. Passwords are bcrypt
hashes and never returned.

`nickname` may be empty. The server then uses the email's local part (the text
before `@`, cut to 50 characters). If that nickname is taken it tries `name2`,
`name3`, … and finally a random 6-digit suffix. A one-character local part
starts at `name2`. A nickname sent explicitly is never changed: if it is taken
the call fails with `duplicate_user`. Nicknames cannot contain `@`, because
`Login` treats an identifier with `@` as an email. The response's
`user.nickname` holds the name that was stored.

### `Login`

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
one identifier/IP pair and 30 attempts across all identifiers from one IP. A successful login sets the refresh cookie (see `Refresh`).
Successful authentication clears the matching pair. A limited request returns
gRPC status `RESOURCE_EXHAUSTED` (HTTP `429`), application code `login_rate_limit`, and `Retry-After: 900` metadata.
See [Client IP](#client-ip) for how the source IP is determined.

### `Me`

Validates a non-expired access token without a database lookup and returns its
user claims: ID, nickname, email, phone, registration date, and status.

### `Refresh`

```json
{}
```

Takes no fields: the refresh token travels only in the `jadren_refresh` cookie
(`HttpOnly`, `SameSite=Strict`, `Path=/rpc/jadren.v1.AuthService/`, `Secure`
over HTTPS), which page scripts cannot read. Each call rotates the token and
returns a new access token. The server reloads the user and only refreshes
status `0` or `1`.

A session lasts 30 days from sign-in; refreshing does not extend it.
`refreshWindow` in the response is the number of seconds left. The token
replaced by a rotation keeps working for 30 seconds so parallel tabs do not
sign each other out. Presenting it after that is treated as theft and revokes
the whole session. An invalid token returns `UNAUTHENTICATED` with
`invalid_refresh_token` and clears the cookie.

### `Logout`

```json
{}
```

Revokes the cookie's session and clears the cookie. Access tokens already
issued to it expire on their own within 15 minutes.

### `SendPasswordResetCode`

```json
{ "email": "user@example.com", "locale": "en" }
```

Always succeeds, so the response does not reveal whether an account exists. A
code is mailed only when the account exists and is not banned. Sending shares
the limits described under `SendVerificationCode`.

### `ResetPassword`

```json
{ "email": "user@example.com", "code": "123456", "newPassword": "at-least-8-characters" }
```

Consumes the code and sets the new password. An unverified account becomes
verified, since the code proves the address. Every existing session of the
user is revoked; the caller is signed in to a new one and receives a
`TokenResponse`.

### `SendVerificationCode`

```json
{ "email": "user@example.com", "locale": "en" }
```

For accounts created before sign-up required a code (`status: 0`). Creates a
six-digit code valid for ten minutes. The database stores only its bcrypt
hash. send-api (send.koi.ci) sends the HTML and plain-text email from `no-reply@jadren.me`.
`locale` accepts `en` or `zh` and defaults to English.

Every code-sending method shares one limiter in a local Bun SQLite database:
each email may receive six codes per three hours, and each client IP may
request 30 per hour. Either limit fails with `RESOURCE_EXHAUSTED` (HTTP `429`).

### `VerifyEmail`

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

Consumes a valid, unexpired code and atomically changes the account from
`status: 0` to `status: 1`.

## Email codes

Codes live in the `email_code` table, keyed by email and purpose (`register`,
`verify` or `reset`); sending a new code replaces the pending one. Each code
allows five checks, counting correct ones, tracked in the SQLite limiter.
After that the code is deleted and checks fail with
`verification_attempts_exceeded` (HTTP `429`) until a new code is sent. Other
failures are `invalid_verification_code` and `verification_code_expired`.

## Sessions and access tokens

Access tokens are JWTs valid for 15 minutes and carry the session ID in `sid`.
They are verified without a database lookup, so revoking a session or banning
a user (status `2`) takes effect at the next refresh, at most 15 minutes later.
Login and refresh are refused immediately.

Sessions are rows in `auth_session`, which stores only SHA-256 hashes of the
current and previous refresh token. Dead sessions of a user are deleted
whenever that user signs in again.

## Client IP

Rate limits key on the `X-Real-IP` header, which nginx must set to
`$remote_addr`. No other forwarded-IP header is trusted. Behind Cloudflare,
configure nginx's `real_ip` module with Cloudflare's ranges so `$remote_addr`
is the visitor rather than Cloudflare.

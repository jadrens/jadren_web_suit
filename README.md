# Jadren Web Suit

English · [简体中文](README.zh-CN.md)

Website: [jadren.me](https://jadren.me)

An integrated personal web platform powered by Next.js, combining a bilingual blog, community publishing, online utilities, English-learning tools, and reminders under one domain and account system.

## Overview

Jadren Web Suit is more than a static blog. It combines publishing, practical utilities, and user services in one application. Visitors can read bilingual articles and use browser tools; verified users can submit articles, retain personal learning data, create short links, and schedule email reminders; administrators review and publish contributions through a dedicated moderation workflow.

The application uses a single-origin design. The portal is served at `/`, with the blog, tools, accounts, and settings under paths such as `/blog`, `/tools`, `/login`, and `/settings`. Next.js rewrites map these public URLs to internal site modules.

## Highlights

- **Bilingual blog:** Chinese and English posts, tags, search, view counts, adjacent-post navigation, a table of contents, and reading progress.
- **Markdown and HTML:** GFM, LaTeX/KaTeX, syntax highlighting, and regular HTML.
- **Safe submissions:** Raw HTML is sanitized with an allowlist; scripts, embedded pages, forms, event handlers, and dangerous URLs do not reach the page.
- **Community publishing:** Every verified account can submit changes, which stay pending until approved by an administrator.
- **Contribution history:** Authors, draft owners, last editors, and published contributors are tracked independently.
- **Audited moderation:** Approval messages and rejection/deletion reasons are emailed, with delivery results retained in an audit log.
- **Shared accounts:** Registration, sign-in, email verification, token refresh, and administrator permissions.
- **Online utilities:** Base64, colour conversion, DNS, DNS leak testing, IP information, QR codes, short links, and reminders.
- **English learning:** Grammar polishing, AI chat, vocabulary drills, and sentence practice; LLM profiles stay in the user's browser by default.
- **Optional LLM cloud backup:** Encrypt settings in the browser with a separate passphrase, upload them, and restore them on another device. Because the backup contains API keys, this feature is not recommended and cannot promise absolute security.
- **Interface:** Chinese and English UI, dark/light themes, and responsive layouts.

## Technology

| Area | Technology |
| --- | --- |
| Web framework | Next.js 16 (App Router) |
| UI | React 19, MUI 9, Emotion, Tailwind CSS 4 |
| Language and runtime | TypeScript and Bun |
| Database | PostgreSQL |
| Content | react-markdown, remark-gfm, KaTeX, rehype-highlight |
| HTML security | rehype-raw with a rehype-sanitize allowlist |
| Authentication and email | bcrypt, JWT (jose), Resend |
| Animation | Framer Motion and Matter.js |

## Quick start

Bun 1.4 or a compatible release and PostgreSQL are required.

```bash
git clone https://github.com/jadrens/jadren_web_suit.git
cd jadren_web_suit/main
bun install
```

Create `.env.local`:

```dotenv
DATABASE_URL=postgresql://user:password@127.0.0.1:5432/jadren
POSTGRES_SSL=false

# At least 32 characters
JWT_SECRET=replace-with-a-long-random-secret

# Verification, moderation, and reminder email
RESEND_API_KEY=re_xxxxxxxxx
AUTH_FROM_EMAIL=Jadren <account@example.com>
REMINDER_FROM_EMAIL=Jadren Reminder <reminder@example.com>

# Only required by the DNS manager/leak backend
DNS_MANAGER_TOKEN=optional-token
```

Instead of `DATABASE_URL`, set `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` separately. Configure `POSTGRES_SSL` for the production database environment.

Initialize and start development:

```bash
bun run db:setup
bun run dev
```

Open `http://localhost:3000`. For the configured local domain, add `127.0.0.1 jadren.debug` to `/etc/hosts`, then open `http://jadren.debug:3000`.

The vocabulary pronunciation API needs `pico2wave`, `espeak-ng`, or `espeak` installed on the server, tried in that order. Its per-IP rate limit uses the writable `.data/tts-request-monitor.sqlite` file.

## Article submission and moderation

1. A user registers and verifies their email address.
2. The user creates or edits an article at `/editor`.
3. Saves go to `blog_post_pending` without changing the public article.
4. An administrator reviews, edits, forks, approves, or rejects it at `/admin`.
5. Approval synchronizes content and tags in a transaction, updates contributors, and sends a notification.

Grant administrator access with PostgreSQL:

```sql
UPDATE user_main SET is_admin = TRUE WHERE user_id = 'user UUID';
```

PostgreSQL is the source of truth for published articles. `content/posts/{zh,en}` is retained only as a legacy migration source:

```bash
bun run blog:import
```

## HTML security policy

Articles may use ordinary HTML such as paragraphs, tables, disclosure widgets, images, and text formatting. Draft previews and public articles share the same allowlist pipeline.

The sanitizer removes:

- `script`, `iframe`, `frame`, `object`, `embed`, and `applet`
- `form`, `input`, `button`, `select`, and `textarea`
- `style`, `link`, `meta`, and `base`
- Event attributes such as `onclick` and `onerror`
- Dangerous URL protocols such as `javascript:`

Sanitization runs before KaTeX and syntax highlighting, preventing user content from abusing their generated markup to bypass the allowlist.

## LLM settings cloud backup

LLM providers, models, and API keys remain in the current browser by default. After signing in with a verified account, the settings page offers manual upload and download actions. This feature is **not recommended**: cloud data containing API keys always carries risk, and no system can guarantee complete security.

Before upload, the browser derives a key from a separate backup passphrase with PBKDF2-SHA-256 and encrypts the settings using AES-256-GCM. The server stores only ciphertext, salt, and IV; it never receives or stores the passphrase. Decryption also happens only in the browser. The passphrase cannot be recovered, and downloading replaces the LLM settings currently stored in that browser.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start development |
| `bun run build` | Create a production build |
| `bun run start` | Start production |
| `bun run lint` | Run ESLint |
| `bun test` | Run tests |
| `bun run db:setup` | Apply the PostgreSQL schema |
| `bun run blog:import` | Import legacy Markdown once |
| `bun run ncee:build` | Build NCEE vocabulary data |
| `bun run reminder:dispatch` | Dispatch due reminders |
| `bun run deploy:run` | Run tasks under `scripts/deploy` |

## Project layout

```text
main/
├── content/                  # About content and legacy article imports
├── database/                 # PostgreSQL schema and setup
├── deploy/                   # systemd and Nginx examples
├── docs/                     # Architecture, blog, and API documentation
├── public/            # Fonts, icons, avatar, and backgrounds
├── scripts/                  # Import, data, reminder, and deployment jobs
└── src/
    ├── app/                  # Pages and APIs mapped directly to public URLs
    ├── components/           # Page components
    ├── config/               # Blog and tool configuration
    ├── hooks/                # Page hooks
    ├── lib/                  # Auth, database, email, i18n, and client APIs
    ├── styles/               # Feature styles
    └── theme/                # Global theme
```

See [`docs/blog/architecture.md`](docs/blog/architecture.md) for design details and [`docs/tool/auth-api.md`](docs/tool/auth-api.md) / [`docs/tool/client-api.md`](docs/tool/client-api.md) for API documentation.

## Deployment

```bash
bun run build
bun run start -- -p 3000
```

The application does not terminate TLS. Use a reverse proxy in production. An Nginx example is available at [`deploy/nginx.conf.example`](deploy/nginx.conf.example), with systemd units under `deploy/`.

GitHub Actions builds the application, synchronizes the server, applies the database schema, runs `scripts/deploy/` tasks in order, installs service units, and performs a health check. Deployment is disabled by default. Set the repository variable `DEPLOY_ENABLED=true`, then run the **Deploy** workflow manually and pick a target: `global` deploys `main` to jadren.me (environment `production-global`), `cn` deploys `main-cn` to jadren.cn (environment `production-cn`). Repository secrets hold what both sites share (database, JWT, email, DNS token); each environment holds its own server's `SSH_*` secrets. Day-to-day work happens on `dev`; `main-cn` carries the CN-only patch (domain, ICP filing number, removed services) on top of `main`. Tasks must be safe to retry, and `database/schema.sql` must always describe the final database state.

## License

Released under the [MIT License](LICENSE). Third-party data and asset licenses are listed in [`THIRD_PARTY_LICENSES`](THIRD_PARTY_LICENSES).

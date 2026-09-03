# Dragonren main

One integrated Next.js site containing the blog, tools, about page, settings, and account features.

## Development

```sh
bun install
bun run dev
```

For local domain testing, add this entry to `/etc/hosts`:

```text
127.0.0.1 jadren.debug
```

Then use this local URL:

- `http://jadren.debug:3000`

## Blog editor and PostgreSQL

Published Markdown and pending edits are stored in PostgreSQL. Initialize the
schema, import the existing repository articles once, then open the editor:

```sh
bun run db:setup
bun run blog:import
```

The editor is available at `http://jadren.debug:3000/editor` to every verified
account. All changes are saved as pending submissions. Grant administrator access
with `UPDATE user_main SET is_admin = TRUE WHERE user_id = '…'`; administrators
review all submissions at `/admin` and atomically publish approved content and tags.
Administrators may also reject and delete a pending submission with a required
reason; the submitter is notified by audited email, and delivery failures are retained.
Pending submissions track their author, owner, and last editor separately. Admins
may edit any submission or fork it into an admin-owned copy. Approval supports an
optional message, notifies the submission author, and updates the article contributor table.

Public routes share one origin. Blog pages live under `/blog`, tools under `/tools`, and `/about`, `/settings`, account pages, and APIs are part of the same site. Static path rewrites in `next.config.ts` connect those URLs to the internal route groups; no hostname proxy is used.

## Deployment

The production workflow is in `.github/workflows/deploy.yml`. It builds on GitHub Actions, uploads only the verified Next.js build, synchronizes the server checkout, applies the final database schema, runs every `.ts`, `.js`, and `.sh` task in `scripts/deploy/`, installs the systemd units, restarts the service, and performs a local health check.

Deployment remains disabled until the repository variable `DEPLOY_ENABLED=true` is configured. A push to the `run` branch deploys production. See `deploy/nginx.conf.example` for serving the canonical hostname and redirecting legacy subdomains.

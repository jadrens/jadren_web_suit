# Dragonren main

One Next.js application serving the former `start`, `blog`, and `tool` projects by hostname.

## Development

```sh
bun install
bun run dev
```

For cross-site login testing, add these entries to `/etc/hosts`:

```text
127.0.0.1 jadren.debug
127.0.0.1 blog.jadren.debug
127.0.0.1 tool.jadren.debug
```

Then use these local URLs:

- `http://jadren.debug:3000`
- `http://blog.jadren.debug:3000`
- `http://tool.jadren.debug:3000`

The `*.localhost` hosts remain available for isolated site development, but they
cannot reliably share an authentication cookie across subdomains.

## Blog editor and PostgreSQL

Published Markdown and pending edits are stored in PostgreSQL. Initialize the
schema, import the existing repository articles once, then open the editor on
the blog host:

```sh
bun run db:setup
bun run blog:import
```

The editor is available at `http://blog.jadren.debug:3000/editor` to every verified
account. All changes are saved as pending submissions. Grant administrator access
with `UPDATE user_main SET is_admin = TRUE WHERE user_id = '…'`; administrators
review all submissions at `/admin` and atomically publish approved content and tags.
Administrators may also reject and delete a pending submission with a required
reason; the submitter is notified by audited email, and delivery failures are retained.
Pending submissions track their author, owner, and last editor separately. Admins
may edit any submission or fork it into an admin-owned copy. Approval supports an
optional message, notifies the submission author, and updates the article contributor table.

Public requests are rewritten internally to `src/app/sites/main`, `src/app/sites/blog`, or `src/app/sites/tool`. The `/sites/*` prefix is an implementation detail and is not part of public URLs.

## Production hosts

Edit `HOST_TO_SITE` in `src/proxy.ts` to replace the example production domains with the deployed domains.

## Deployment

The production workflow is in `.github/workflows/deploy.yml`. It builds on GitHub Actions, uploads only the verified Next.js build, synchronizes the server checkout, applies the final database schema, runs every `.ts`, `.js`, and `.sh` task in `scripts/deploy/`, installs the systemd units, restarts the service, and performs a local health check.

Deployment remains disabled until the repository variable `DEPLOY_ENABLED=true` is configured. A push to the `run` branch deploys production. See `deploy/nginx.conf.example` for routing all three public hostnames to port 3000.

# Dragonren main

One Next.js application serving the former `start`, `blog`, and `tool` projects by hostname.

## Development

```sh
bun install
bun run dev
```

Use these local URLs:

- `http://main.localhost:3000`
- `http://blog.localhost:3000`
- `http://tool.localhost:3000`

Public requests are rewritten internally to `src/app/sites/main`, `src/app/sites/blog`, or `src/app/sites/tool`. The `/sites/*` prefix is an implementation detail and is not part of public URLs.

## Production hosts

Edit `HOST_TO_SITE` in `src/proxy.ts` to replace the example production domains with the deployed domains.

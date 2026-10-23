#!/usr/bin/env bash
# Installs a release archive built by .github/workflows/deploy.yml and restarts the site.
#
# Runs on the server. It never contacts GitHub: the archive already contains the source and
# the build, dependencies come from the registry pinned in bun.lock (registry.npmmirror.com),
# and Bun is fetched from BUN_MIRRORS and verified against BUN_SHA256. That keeps deploys
# working on servers in mainland China.
#
# Usage: install-release.sh <extracted-release-dir>
# Environment:
#   DEPLOY_PATH   live directory, e.g. /home/dragonren/service/web/jadren_web_suit
#   SITE_HOST     Host header for the health check (jadren.me / jadren.cn)
#   BUN_VERSION   Bun version to run, e.g. 1.4.0
#   BUN_SHA256    sha256 of bun-linux-x64.zip for BUN_VERSION
#   BUN_MIRRORS   space-separated download URLs for bun-linux-x64.zip, tried in order
#   plus the application secrets written to .env (see write_env).
set -Eeuo pipefail

release="$(realpath "$1")"
: "${DEPLOY_PATH:?}" "${SITE_HOST:?}" "${BUN_VERSION:?}" "${BUN_SHA256:?}" "${BUN_MIRRORS:?}"
previous="$DEPLOY_PATH.previous"
bun_bin="$HOME/.bun/bin/bun"

log() { printf '==> %s\n' "$*"; }

ensure_bun() {
  if [ -x "$bun_bin" ] && [ "$("$bun_bin" --version)" = "$BUN_VERSION" ]; then return; fi
  if [ "$(uname -m)" != "x86_64" ]; then
    echo "BUN_SHA256 pins the x64 build; this server is $(uname -m)" >&2
    return 1
  fi

  local tmp url
  tmp="$(mktemp -d)"
  for url in $BUN_MIRRORS; do
    log "Downloading Bun $BUN_VERSION from $url"
    if curl -fsSL --retry 2 --connect-timeout 15 --max-time 300 -o "$tmp/bun.zip" "$url" \
      && echo "$BUN_SHA256  $tmp/bun.zip" | sha256sum --check --status; then
      unzip -oq "$tmp/bun.zip" -d "$tmp"
      install -D -m 0755 "$tmp/bun-linux-x64/bun" "$bun_bin"
      rm -rf "$tmp"
      return
    fi
    log "Download failed or checksum mismatch, trying the next mirror"
  done
  rm -rf "$tmp"
  echo "Could not install Bun $BUN_VERSION from any mirror" >&2
  return 1
}

write_env() {
  (
    umask 077
    {
      printf "DNS_MANAGER_TOKEN=%s\n" "$DNS_MANAGER_TOKEN"
      printf "POSTGRES_USER=%s\n" "$POSTGRES_USER"
      printf "POSTGRES_PASSWORD=%s\n" "$POSTGRES_PASSWORD"
      printf "POSTGRES_DB=%s\n" "$POSTGRES_DB"
      printf "POSTGRES_HOST=%s\n" "$POSTGRES_HOST"
      printf "POSTGRES_PORT=%s\n" "$POSTGRES_PORT"
      printf "POSTGRES_SSL=%s\n" "$POSTGRES_SSL"
      printf "JWT_SECRET=%s\n" "$JWT_SECRET"
      printf "RESEND_API_KEY=%s\n" "$RESEND_API_KEY"
    } > "$release/.env"
  )
}

ensure_bun
export PATH="$(dirname "$bun_bin"):$PATH"

# Prepare the new release next to the live one, so the site keeps serving meanwhile.
# bun links node_modules with relative symlinks, so the directory can be moved afterwards.
cd "$release"
log "Installing dependencies"
bun install --frozen-lockfile
write_env
bun run db:setup
bun run deploy:run

log "Installing service units"
sudo install -m 0644 deploy/jadren-web-suit.service /etc/systemd/system/jadren-web-suit.service
sudo install -m 0644 deploy/jadren-reminder-dispatch.service /etc/systemd/system/jadren-reminder-dispatch.service
sudo install -m 0644 deploy/jadren-reminder-dispatch.timer /etc/systemd/system/jadren-reminder-dispatch.timer
sudo systemctl daemon-reload

log "Switching releases"
sudo systemctl stop jadren-web-suit.service 2>/dev/null || true
# .data holds runtime state (rate-limit databases, downloaded dictionaries) and moves to the
# new release. data/ ships with the source; files the server added there are kept too.
if [ -d "$DEPLOY_PATH/.data" ]; then
  mv "$DEPLOY_PATH/.data" "$release/.data"
else
  mkdir -p "$release/.data"
fi
mkdir -p "$release/data"
if [ -d "$DEPLOY_PATH/data" ]; then
  cp -an "$DEPLOY_PATH/data/." "$release/data/"
fi
rm -rf "$previous"
if [ -e "$DEPLOY_PATH" ]; then
  mv "$DEPLOY_PATH" "$previous"
fi
mkdir -p "$(dirname "$DEPLOY_PATH")"
mv "$release" "$DEPLOY_PATH"

sudo systemctl enable jadren-web-suit.service
sudo systemctl enable --now jadren-reminder-dispatch.timer
sudo systemctl restart jadren-web-suit.service
sudo systemctl is-active --quiet jadren-reminder-dispatch.timer

# Startup verifies the dictionary databases before serving, so allow it some time.
log "Waiting for $SITE_HOST to respond"
for _ in $(seq 1 60); do
  if curl --fail --silent --output /dev/null --header "Host: $SITE_HOST" http://127.0.0.1:3000/; then
    log "Release is live; the previous one is kept at $previous"
    exit 0
  fi
  sleep 2
done

sudo journalctl -u jadren-web-suit.service -n 100 --no-pager
echo "Health check failed. To roll back: stop the service, move .data back into $previous," >&2
echo "swap $previous with $DEPLOY_PATH, and start the service again." >&2
exit 1

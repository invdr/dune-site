#!/usr/bin/env bash
#
# DUNE — VPS deploy/update script (run ON the server, not from CI).
#
# Performs the repeatable release steps from docs/DEPLOYMENT_VPS.md §12:
#   pull -> install -> prisma generate + migrate deploy -> build front-ends ->
#   restart systemd services.
#
# First-time provisioning (apt packages, PostgreSQL, .env files, systemd units,
# nginx, TLS) is a one-off and lives in docs/DEPLOYMENT_VPS.md — run that first.
#
# Usage (on the VPS, as the deploy user):
#   cd /opt/dune
#   DEPLOY_BRANCH=claude/focused-fermat-2t05rc ./scripts/deploy-vps.sh
#
# Environment overrides:
#   APP_DIR        repo root on the server         (default: script's repo root)
#   DEPLOY_BRANCH  branch the server ships from     (default: current branch)
#   SKIP_BUILD=1   skip front-end builds (backend-only change)
#   NO_RESTART=1   do everything except systemctl restart

set -euo pipefail

# --- resolve repo root -------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
cd "$APP_DIR"

# Make bun available for non-interactive shells (systemd/cron-style).
export PATH="$HOME/.bun/bin:$PATH"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

command -v bun >/dev/null || die "bun not found on PATH ($HOME/.bun/bin). Install bun first."
command -v node >/dev/null || die "node not found on PATH. Install Node 22 first."

# --- 1. sync code ------------------------------------------------------------
BRANCH="${DEPLOY_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
log "Deploying branch: $BRANCH"

if [[ -n "$(git status --porcelain)" ]]; then
  die "Working tree is dirty on the server. Commit/stash/clean it by hand before deploying — this script will not touch your changes."
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git merge --ff-only "origin/$BRANCH" || die "Cannot fast-forward $BRANCH to origin. Resolve by hand."
log "Now at commit: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# --- 2. dependencies ---------------------------------------------------------
log "Installing workspace dependencies"
bun install --frozen-lockfile

# --- 3. database -------------------------------------------------------------
log "Generating Prisma client"
bun run --cwd backend prisma:generate
log "Applying database migrations (prisma migrate deploy)"
bun run --cwd backend prisma:deploy

# --- 4. build front-ends -----------------------------------------------------
if [[ "${SKIP_BUILD:-0}" == "1" ]]; then
  log "SKIP_BUILD=1 — skipping front-end builds"
else
  log "Building webapp (admin SPA)"
  bun run --cwd webapp build
  log "Building website (Astro SSR)"
  bun run --cwd website build
fi

# --- 5. restart services -----------------------------------------------------
if [[ "${NO_RESTART:-0}" == "1" ]]; then
  log "NO_RESTART=1 — leaving services running. Restart manually when ready."
else
  log "Restarting systemd services"
  sudo systemctl restart dune-backend dune-website
  sleep 2
  sudo systemctl --no-pager --lines=0 status dune-backend dune-website || true
fi

log "Deploy complete."
echo "Health check:  curl -fsS https://api.<your-domain>/health"

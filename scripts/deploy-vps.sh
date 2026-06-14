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
#   LOW_MEM=1      low-RAM servers (≤1 GB): cap Node heap and stop the website
#                  service during the build to free memory. Causes a brief
#                  public-site outage while building — fine for a tiny VPS.
#                  Make sure swap is enabled (see docs/DEPLOYMENT_VPS.md §2).
#   NODE_HEAP_MB   Node heap cap in MB under LOW_MEM            (default: 512)

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
  WEBSITE_STOPPED=0
  if [[ "${LOW_MEM:-0}" == "1" ]]; then
    # Cap the Node heap so the Astro build can't balloon past available RAM.
    export NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB:-512} ${NODE_OPTIONS:-}"
    log "LOW_MEM=1 — Node heap capped at ${NODE_HEAP_MB:-512} MB"

    if ! swapon --show | grep -q .; then
      printf '\033[1;33mWARNING: no swap is active. On a 1 GB VPS the build may still OOM. See docs/DEPLOYMENT_VPS.md §2 to add swap.\033[0m\n'
    fi

    # Free the website server's RAM during the build (brief public-site outage).
    if systemctl is-active --quiet dune-website 2>/dev/null; then
      log "Stopping dune-website to free memory during the build"
      sudo systemctl stop dune-website
      WEBSITE_STOPPED=1
    fi
  fi

  # Build one at a time so the two peaks never overlap.
  log "Building webapp (admin SPA)"
  bun run --cwd webapp build
  log "Building website (Astro SSR)"
  bun run --cwd website build

  if [[ "$WEBSITE_STOPPED" == "1" && "${NO_RESTART:-0}" == "1" ]]; then
    log "Restarting dune-website (was stopped for the build)"
    sudo systemctl start dune-website
  fi
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

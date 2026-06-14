# Deployment — VPS (sweb.ru)

Runbook for deploying the DUNE stack to a self-managed Linux VPS (e.g. sweb.ru),
without DigitalOcean App Platform or any PaaS. For the managed-PaaS path see
[DEPLOYMENT.md](DEPLOYMENT.md); this file is the VPS alternative.

Assumes Ubuntu/Debian with root (or sudo). Commands use `apt` and `systemd`.
Replace the example domains with your own throughout.

## 1. Architecture on one VPS

Three app processes + PostgreSQL behind nginx (TLS by Let's Encrypt):

| Surface | What it is | Process | Port | Public domain (example) |
| --- | --- | --- | --- | --- |
| **backend** | Hono API (Bun) | systemd `dune-backend` | `127.0.0.1:3000` | `https://api.dunestate.ru` |
| **website** | Astro SSR (standalone server, run with Bun) | systemd `dune-website` | `127.0.0.1:4321` | `https://dunestate.ru` |
| **webapp** | React admin SPA (static files) | served by nginx (no process) | — | `https://admin.dunestate.ru` |
| **db** | PostgreSQL 16 | system service | `127.0.0.1:5432` | — (local only) |
| **cron** | fx / quickdeal / leads jobs | systemd timers | — | — |

The frontends are **built with the API URL baked in** (`VITE_API_URL` for webapp,
`PUBLIC_API_URL` for website). Changing the API domain means **rebuilding** the
frontends, not just restarting.

Auth runs **cross-origin** (admin and website on different domains call the API
with cookies), so `COOKIE_SECURE=true`, all origins are HTTPS, and
`CORS_ORIGINS` must list every browser origin exactly.

## 2. Prerequisites (install once)

```bash
# System packages
sudo apt update
sudo apt install -y curl git nginx postgresql postgresql-contrib certbot python3-certbot-nginx unzip

# Bun — runs the backend, the build tooling, AND the Astro website server.
# Node is NOT required: Bun runs the Astro standalone server (dist/server/entry.mjs).
curl -fsSL https://bun.sh/install | bash
# add to PATH (e.g. in ~/.bashrc):  export PATH="$HOME/.bun/bin:$PATH"
```

Confirm: `bun --version` (≥ 1.3). (No Node install needed — Bun serves the
website too.)

### Swap (required on ≤ 1 GB VPS)

The front-end builds (Vite + Astro) briefly peak around 0.4–0.6 GB **each**. On a
1 GB server that build can run out of memory and get killed. Add 2 GB of swap so
the build completes (it just spills to disk while building):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # persist across reboots
free -h                                                       # verify Swap row
```

The backend itself (Bun runs TypeScript directly, no build) and the running
services are light — only the build step is memory-hungry. On ≤ 1 GB always
deploy with `LOW_MEM=1` (see §12).

## 3. PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER dune WITH PASSWORD 'CHANGE_ME_STRONG';
CREATE DATABASE dune_prod OWNER dune;
SQL
```

Connection string (local socket over TCP):
`postgresql://dune:CHANGE_ME_STRONG@127.0.0.1:5432/dune_prod?schema=public`

Keep Postgres bound to `127.0.0.1` only (default). Do not expose 5432 publicly.

## 4. Get the code

Deploy as a non-root user (example `deploy`) into `/opt/dune`:

```bash
sudo mkdir -p /opt/dune && sudo chown "$USER" /opt/dune
git clone <your-repo-url> /opt/dune
cd /opt/dune
git checkout <release-branch>      # the branch you ship from
bun install                        # installs the whole workspace
```

## 5. Environment files

**Backend** — `/opt/dune/backend/.env` (never commit this):

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://dune:CHANGE_ME_STRONG@127.0.0.1:5432/dune_prod?schema=public
JWT_SECRET=<run: openssl rand -hex 32>
CORS_ORIGINS=https://dunestate.ru,https://admin.dunestate.ru
COOKIE_SECURE=true
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30

# Public self-registration is OFF in production. Leave this "false" so nobody
# who finds POST /api/auth/register can claim an admin account. To create the
# first admin (or add staff later), flip to "true", restart dune-backend,
# register, then set it back to "false" and restart again (§11).
REGISTRATION_ENABLED=false

# QuickDeal feed (object sync). Leave blank to disable the importer.
QUICKDEAL_FEED_URL=
QUICKDEAL_FEED_TOKEN=

# Photo uploads (optional). Without these, uploads are off and hot-linked
# image URLs still work. Point at any S3-compatible bucket (e.g. Yandex Object
# Storage) when you want admin uploads.
# SPACES_REGION=
# SPACES_BUCKET=
# SPACES_ENDPOINT=
# SPACES_ACCESS_KEY_ID=
# SPACES_SECRET_ACCESS_KEY=
# SPACES_CDN_BASE_URL=
```

> `JWT_SECRET` must be a real random 32+ char secret (not the placeholder).
> `CORS_ORIGINS` must be HTTPS, exact origins (no paths, no `*`).
> Telegram, Bitrix and the Yandex Maps key are **not** env vars — they are set
> later in the admin Settings screen and stored in the database.

**Website** — `/opt/dune/website/.env` (build-time, `PUBLIC_*` are inlined):

```bash
PUBLIC_API_URL=https://api.dunestate.ru
PUBLIC_SITE_URL=https://dunestate.ru
```

**Webapp** — `/opt/dune/webapp/.env` (build-time):

```bash
VITE_API_URL=https://api.dunestate.ru
```

## 6. Database migrations (+ optional demo seed)

```bash
cd /opt/dune/backend
bun run prisma:generate
bun run prisma:deploy           # applies all migrations to dune_prod

# Optional: only for an empty staging DB you want pre-filled with demo data.
# Do NOT run on a production DB that already has real objects.
# bun run prisma:seed
```

## 7. Build the frontends

```bash
cd /opt/dune
bun run --cwd webapp build      # -> webapp/dist  (static SPA)
bun run --cwd website build     # -> website/dist/server/entry.mjs + dist/client
```

## 8. systemd services

**Backend** — `/etc/systemd/system/dune-backend.service`:

```ini
[Unit]
Description=DUNE backend API
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/dune/backend
EnvironmentFile=/opt/dune/backend/.env
ExecStart=/home/deploy/.bun/bin/bun src/index.ts
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

> `start:raw`/`src/index.ts` skips `prisma generate` (already done at deploy),
> so startup is fast. Run `bun run prisma:generate` after every `git pull`.

**Website** — `/etc/systemd/system/dune-website.service`:

```ini
[Unit]
Description=DUNE website (Astro SSR)
After=network.target dune-backend.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/dune/website
Environment=HOST=127.0.0.1
Environment=PORT=4321
Environment=PUBLIC_API_URL=https://api.dunestate.ru
ExecStart=/home/deploy/.bun/bin/bun ./dist/server/entry.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dune-backend dune-website
sudo systemctl status dune-backend dune-website
```

The **webapp has no service** — it is static files; nginx serves
`/opt/dune/webapp/dist` directly (section 10).

## 9. Cron jobs (systemd timers)

Three scheduled tasks call `bun src/cron.ts <task>`:

| Task | Cadence | Purpose |
| --- | --- | --- |
| `fx:refresh` | daily | refresh USD→RUB rate from the CBR |
| `quickdeal:sync` | hourly | mirror objects from the QuickDeal feed |
| `leads:redeliver` | every 5 min | retry leads whose Telegram/Bitrix send failed |

Generic service template `/etc/systemd/system/dune-cron@.service`:

```ini
[Unit]
Description=DUNE cron task %i
After=network.target postgresql.service

[Service]
Type=oneshot
User=deploy
WorkingDirectory=/opt/dune/backend
EnvironmentFile=/opt/dune/backend/.env
ExecStart=/home/deploy/.bun/bin/bun src/cron.ts %i
```

Timers (one file each):

`/etc/systemd/system/dune-cron-fx:refresh.timer`
```ini
[Unit]
Description=DUNE fx:refresh daily
[Timer]
OnCalendar=*-*-* 06:00:00
Persistent=true
Unit=dune-cron@fx:refresh.service
[Install]
WantedBy=timers.target
```

`/etc/systemd/system/dune-cron-quickdeal:sync.timer`
```ini
[Unit]
Description=DUNE quickdeal:sync hourly
[Timer]
OnCalendar=*-*-* *:00:00
Persistent=true
Unit=dune-cron@quickdeal:sync.service
[Install]
WantedBy=timers.target
```

`/etc/systemd/system/dune-cron-leads:redeliver.timer`
```ini
[Unit]
Description=DUNE leads:redeliver every 5 min
[Timer]
OnCalendar=*:0/5
Persistent=true
Unit=dune-cron@leads:redeliver.service
[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now \
  "dune-cron-fx:refresh.timer" \
  "dune-cron-quickdeal:sync.timer" \
  "dune-cron-leads:redeliver.timer"
sudo systemctl list-timers 'dune-cron*'
```

> If `:` in unit names is awkward on your systemd version, rename the timers to
> `dune-cron-fx.timer` etc. (the `%i` after `@` is what must stay `fx:refresh`).
> A plain root `crontab -e` with the same three `bun src/cron.ts <task>` lines
> works just as well if you prefer.

## 10. nginx + TLS

Point DNS A-records for `dunestate.ru`, `admin.dunestate.ru`,
`api.dunestate.ru` at the VPS first.

`/etc/nginx/sites-available/dune`:

```nginx
# --- API ---
server {
  server_name api.dunestate.ru;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  listen 80;
}

# --- Website (Astro SSR) ---
server {
  server_name dunestate.ru www.dunestate.ru;
  location / {
    proxy_pass http://127.0.0.1:4321;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  listen 80;
}

# --- Admin SPA (static) ---
server {
  server_name admin.dunestate.ru;
  root /opt/dune/webapp/dist;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;   # SPA fallback
  }
  listen 80;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/dune /etc/nginx/sites-enabled/dune
sudo nginx -t && sudo systemctl reload nginx

# Issue + auto-renew TLS (this rewrites the blocks to listen 443 with certs)
sudo certbot --nginx -d api.dunestate.ru -d dunestate.ru -d www.dunestate.ru -d admin.dunestate.ru
```

After certbot, confirm `CORS_ORIGINS` and the build-time API URLs all use
`https://` and match the certificated domains.

## 11. Post-deploy configuration (in the admin panel)

### Create the first admin (registration is gated)

There is no public sign-up UI, and `REGISTRATION_ENABLED=false` blocks the
register endpoint. To create the first account, enable it briefly:

```bash
sed -i 's/^REGISTRATION_ENABLED=.*/REGISTRATION_ENABLED=true/' /opt/dune/backend/.env
sudo systemctl restart dune-backend

curl -fsS -X POST https://api.dunestate.ru/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"a-strong-password","displayName":"Admin"}'

# Close it again — important.
sed -i 's/^REGISTRATION_ENABLED=.*/REGISTRATION_ENABLED=false/' /opt/dune/backend/.env
sudo systemctl restart dune-backend
```

Use the same steps to add staff users later. Log in at `https://admin.dunestate.ru`.

### Settings

Under **Settings** set:

- **Telegram** — bot token + chat id (turns on lead notifications).
- **Bitrix24** — inbound webhook URL + enable toggle (turns on CRM delivery;
  leads carry the object's manager — full auto-assignment needs the
  QuickDeal→Bitrix user map).
- **Яндекс.Карты** — JS API key (turns on the interactive coordinate picker).
- **Currency** — USD→₽ surcharge (default +2 ₽).
- **Managers** — one per direction (fallback when an object has no QuickDeal
  manager).

Then add `QUICKDEAL_FEED_URL` / `QUICKDEAL_FEED_TOKEN` to the backend `.env` and
restart `dune-backend` to start mirroring objects.

## 12. Updating (redeploy)

Use the helper script — it runs the whole sequence and refuses to act on a dirty
server tree:

```bash
cd /opt/dune
# Small VPS (≤ 1 GB RAM) — caps Node heap and frees the website server's RAM
# during the build (short public-site outage while building):
DEPLOY_BRANCH=claude/focused-fermat-2t05rc LOW_MEM=1 ./scripts/deploy-vps.sh

# Larger VPS (≥ 2 GB) — no special memory handling needed:
DEPLOY_BRANCH=claude/focused-fermat-2t05rc ./scripts/deploy-vps.sh
```

The equivalent manual steps:

```bash
cd /opt/dune
git pull
bun install --frozen-lockfile
bun run --cwd backend prisma:generate
bun run --cwd backend prisma:deploy        # apply any new migrations
bun run --cwd webapp build
bun run --cwd website build
sudo systemctl restart dune-backend dune-website
```

Useful overrides: `SKIP_BUILD=1` (backend-only change, no front-end rebuild),
`NO_RESTART=1` (build but don't restart). A blip of downtime during restart is
expected on a single VPS; zero-downtime would need two backend instances behind
nginx — not needed for v1.

## 13. Security checklist

- [ ] `JWT_SECRET` is a real `openssl rand -hex 32` value, not the placeholder.
- [ ] `COOKIE_SECURE=true` and every `CORS_ORIGINS` entry is HTTPS.
- [ ] PostgreSQL listens on `127.0.0.1` only; strong DB password; not in git.
- [ ] `.env` files are `chmod 600` and outside the repo's tracked files.
- [ ] TLS issued for all three domains; HTTP→HTTPS redirect active (certbot does this).
- [ ] Firewall: allow 80/443/SSH only (e.g. `ufw allow OpenSSH; ufw allow 'Nginx Full'`).
- [ ] QuickDeal feed token kept in `.env`, never committed.
```

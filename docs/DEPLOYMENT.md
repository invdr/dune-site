# Deployment

Use this document only after the user has asked for deployment. Read the root [README.md](../README.md) and active surface READMEs first; they record the installed project's active surfaces, deferred surfaces, release targets, and validation scope.

The supported production path is a **single Linux VPS** (for example a [sweb.ru VDS](https://sweb.ru/vds/)) running the whole stack with Docker Compose: PostgreSQL, the backend API, and [Caddy](https://caddyserver.com/) as the reverse proxy. Caddy serves the static `webapp` and `website` builds and proxies the API, and obtains/renews HTTPS certificates automatically. This keeps the production architecture monolithic and operable from one box.

Before deploying, gather the product-facing release details:

- which active surfaces should be released now: backend/API, webapp, website, or full-stack;
- the production domains for the website, webapp, and API (three subdomains by default);
- whether uploads, images, media, exports, or downloads need S3-compatible object storage in this release;
- whether real-time chat, presence, collaboration, or live notifications must work across multiple backend instances (a single VPS runs one backend instance, so cross-instance Pub/Sub is not needed yet);
- whether mobile is active; if yes, switch to the `mobile` branch before mobile release planning.

Local setup from `README.md` and [LOCAL_DATABASE.md](LOCAL_DATABASE.md) does not require any cloud or server credentials.

## What You Need

1. A VPS with a public IPv4 address and SSH access (sweb.ru VDS or any Linux VPS). 1 vCPU / 2 GiB RAM is a reasonable starting size for the full stack; 1 GiB works for low traffic.
2. A domain you control, with DNS that can point records at the VPS IP. The default layout uses three records:
   - `example.com` → website
   - `app.example.com` → webapp
   - `api.example.com` → backend API
   You can collapse these (for example serve the webapp at the apex) by editing `deploy/Caddyfile` and the env domains.
3. Docker Engine and the Docker Compose plugin installed on the VPS.
4. Ports `80` and `443` open to the internet so Caddy can complete the ACME HTTP challenge and serve traffic.

## Release Source Preflight

The VPS builds the images from the repository checked out on the server. Before deploying, verify the release source on the VPS:

```bash
git remote -v
git status --short --branch
```

Deploy only from the intended release branch after the intended commit is checked out, and keep the worktree clean. If the worktree has modified, deleted, or untracked files, stop and report that deployment is blocked. Do not run `git reset`, `git checkout --`, `git clean`, `git stash`, or equivalent cleanup to make deployment possible unless the user explicitly requested that exact destructive action.

## Secrets And Backend Env

Do not store secrets in the repository. Production configuration lives in `deploy/.env.prod` on the VPS, which is git-ignored. Copy the template and fill it in:

```bash
cp deploy/.env.prod.example deploy/.env.prod
```

Minimum values to set:

```bash
WEBSITE_DOMAIN=example.com
WEBAPP_DOMAIN=app.example.com
API_DOMAIN=api.example.com

VITE_API_URL=https://api.example.com
PUBLIC_WEBAPP_URL=https://app.example.com

POSTGRES_DB=web_app_demo
POSTGRES_USER=app
POSTGRES_PASSWORD=<openssl rand -hex 24>

JWT_SECRET=<openssl rand -hex 32>
CORS_ORIGINS=https://app.example.com,https://example.com
COOKIE_SECURE=true
```

Notes:

- `JWT_SECRET` must be a real random value (`openssl rand -hex 32` produces 64 hex characters). The backend rejects placeholder, repeated, or obviously weak secrets in production.
- `CORS_ORIGINS` must list every browser origin that calls the API with credentials, as exact `https://` origins. No wildcards, empty values, or paths. The backend rejects HTTP origins when `COOKIE_SECURE=true`.
- `VITE_API_URL` and `PUBLIC_WEBAPP_URL` are baked into the static bundles at build time. After changing either, rebuild the `caddy` image (`--build`); a running container will not pick up new build-time values.
- If uploads are active, also fill the S3-compatible `SPACES_*` group (any S3-compatible provider works, e.g. self-hosted MinIO on the VPS or an external object store). See [STORAGE.md](STORAGE.md). Leave it blank when uploads are not in scope.

## DNS

Point the three records at the VPS IP before the first `up`, so Caddy can issue certificates:

```
A   example.com        -> <VPS_IP>
A   app.example.com    -> <VPS_IP>
A   api.example.com    -> <VPS_IP>
```

Until DNS resolves, automatic HTTPS will not complete. To smoke-test before DNS is ready, temporarily set a site address in `deploy/Caddyfile` to `:80` (HTTP only).

## First Deploy

On the VPS, from the repository root:

```bash
# 1. Install Docker + Compose plugin (Debian/Ubuntu example).
curl -fsSL https://get.docker.com | sh

# 2. Get the code and check out the release branch.
git clone <repo-url> dune-site && cd dune-site
git checkout <release-branch>

# 3. Configure production env.
cp deploy/.env.prod.example deploy/.env.prod
# edit deploy/.env.prod with real domains, passwords, and JWT_SECRET

# 4. Build and start the whole stack.
docker compose --env-file deploy/.env.prod -f deploy/docker-compose.prod.yml up -d --build
```

The `backend` service runs `prisma migrate deploy` before starting the API, so the schema (including the `uuidv7_compat` migration) is applied automatically on first boot. `migrate deploy` is safe to re-run on every deploy.

Verify:

```bash
docker compose --env-file deploy/.env.prod -f deploy/docker-compose.prod.yml ps
curl -fsS https://api.example.com/health
```

Then in a browser confirm:

- `https://example.com` loads the website;
- `https://app.example.com` loads the webapp, and a deep-link refresh still loads the SPA (Caddy `try_files` fallback);
- login from the webapp works (cross-origin cookies require `COOKIE_SECURE=true`, the API on HTTPS, and the webapp origin present in `CORS_ORIGINS`).

## Updating

To ship a new version:

```bash
cd dune-site
git pull --ff-only
docker compose --env-file deploy/.env.prod -f deploy/docker-compose.prod.yml up -d --build
```

This rebuilds the images (re-baking the static bundles and re-running `migrate deploy`) and restarts the services. PostgreSQL data persists in the `postgres_data` volume; Caddy certificates persist in `caddy_data`.

## Backend, Worker, And Cron

The backend ships as one image with separate entrypoints:

- API service: `bun run start` (`start:api`) — this is what the compose `backend` service runs.
- long-running worker: `bun run start:worker`
- one-shot cron runner: `bun run start:cron`

Keep API, worker, and cron in the same backend workspace so they share the Prisma schema, generated client, env validation, contracts, and feature services. Do not create a second backend package just to run background code.

To run a periodic task on the VPS, prefer a host `cron` entry (or a `systemd` timer) that execs the cron entrypoint inside the running backend container:

```bash
# Example: run a maintenance task daily at 03:00 via the host crontab.
0 3 * * * cd /path/to/dune-site && docker compose --env-file deploy/.env.prod -f deploy/docker-compose.prod.yml exec -T backend bun run start:cron
```

Add a dedicated long-running `worker` service to `deploy/docker-compose.prod.yml` only once a real background handler exists (`src/worker.ts` is intentionally empty until then).

## PostgreSQL

PostgreSQL runs as the `postgres` service on the internal compose network only; no host port is published, so it is not reachable from the internet. The backend connects over the compose network using the `DATABASE_URL` assembled from the `POSTGRES_*` values.

Operational notes:

- Data lives in the `postgres_data` Docker volume. Back it up before destructive schema or data operations.
- A simple backup is `docker compose ... exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql`. Schedule it with host cron and copy dumps off the VPS.
- The schema requires a `uuidv7()` function. PostgreSQL 18 (the image used here) ships it natively; the `uuidv7_compat` migration also installs a portable version for PostgreSQL 13–17 if you point `DATABASE_URL` at an external managed database on an older major version.
- If you later move to an external/managed PostgreSQL that enforces TLS, set `DATABASE_URL` with `sslmode=require`; the backend normalizes such URLs for the Prisma adapter automatically.

## Real-Time And Horizontal Scaling

A single VPS runs one backend instance, so WebSocket/connection state can live in that process and no cross-instance broker is needed. Only when you scale the backend to multiple instances (multiple VPSes or containers behind a load balancer) do features that must deliver the same event to clients on different instances — chat, presence, live notifications — need a shared Redis-compatible Pub/Sub broker. Add one only when that need is real; keep durable state in PostgreSQL and treat Pub/Sub as a transient delivery layer.

## Reverse Proxy, TLS, And Static Sites

Caddy (`deploy/Caddyfile`) terminates TLS and routes by domain:

- `WEBSITE_DOMAIN` serves the prerendered Astro output from `/srv/website`.
- `WEBAPP_DOMAIN` serves the React SPA from `/srv/webapp` with an `index.html` catch-all for client-side routing.
- `API_DOMAIN` reverse-proxies to the backend service on port 8080.

Caddy requests and renews Let's Encrypt certificates automatically for each domain whose DNS points at the VPS and whose ports 80/443 are reachable. The static bundles are built inside `deploy/Dockerfile.web` from the connected Git checkout, not from local `dist` folders, so the branch on the VPS must contain the full monorepo (`package.json`, `bun.lock`, `backend`, `webapp`, `website`, `packages/contracts`).

If the `website` later needs SSR, server islands, or runtime-rendered routes, it stops being fully static: add the Astro Node adapter, opt the specific routes into `prerender = false`, and run the website as its own runtime service (another container, like the backend) instead of serving it as static files from Caddy.

## Object Storage (Uploads)

Storage is optional and disabled until the `SPACES_*` env group is filled. The backend storage service (`backend/src/storage`) uses the S3-compatible AWS SDK, so it works with any S3-compatible provider. On a single VPS the common options are:

- self-host [MinIO](https://min.io/) as another container and point `SPACES_ENDPOINT` at it;
- use an external S3-compatible object store and set its endpoint/credentials.

Do not write uploads to a container filesystem; it is not durable across rebuilds. See [STORAGE.md](STORAGE.md) for the storage contract and presigned-URL flow.

## Validation

Before changing the production server, run the smallest relevant local checks for the active surfaces:

```bash
bun run typecheck
bun run test
bun run build
```

For narrow deployment config work, run the subset that matches the affected surfaces, for example `bun run build:webapp`, `bun run build:website`, or `bun run --cwd backend smoke:docker`.

After deployment, verify:

- `/health` on the API domain returns OK over HTTPS;
- browser auth works only from origins listed in `CORS_ORIGINS`;
- a `webapp` deep-link refresh hits the SPA catch-all instead of a 404;
- the `website` loads static assets from its domain;
- when storage is active, uploads/downloads use presigned URLs and private files require backend authorization;
- Prisma migrations were applied exactly once (`migrate deploy` is idempotent).

## Failure Modes To Watch

- Certificate issuance fails: DNS does not yet point at the VPS, or ports 80/443 are blocked. Fix DNS/firewall, then `up` again.
- Backend crash on startup: empty, placeholder, or weak `JWT_SECRET`, or an HTTP origin in `CORS_ORIGINS` while `COOKIE_SECURE=true`. The env validator rejects these.
- Webapp calling the wrong API: `VITE_API_URL` was empty or wrong at build time. Fix `deploy/.env.prod` and rebuild the `caddy` image.
- Empty website links: `PUBLIC_WEBAPP_URL` missing at build time. Fix and rebuild.
- Cross-origin cookie failures: production cookies require `Secure` and HTTPS; the webapp must send credentials and use a concrete `VITE_API_URL`.
- Lost data after rebuild: ensure PostgreSQL uses the named `postgres_data` volume (uploads must use object storage, not the container filesystem).

## Reference Docs

- sweb.ru VDS: https://sweb.ru/vds/
- Docker Compose: https://docs.docker.com/compose/
- Caddy reverse proxy and automatic HTTPS: https://caddyserver.com/docs/
- Prisma migrations: https://www.prisma.io/docs/orm/prisma-migrate
- MinIO (self-hosted S3-compatible storage): https://min.io/docs/minio/linux/index.html

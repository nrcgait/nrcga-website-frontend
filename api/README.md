# NRCGA API & Staff Portal

Cloudflare Worker providing:

- Public JSON API at `/api/v1/*`
- Staff portal at `/admin`
- D1 content storage + R2 media

## Local setup

```bash
cd api
cp .dev.vars.example .dev.vars   # set JWT_SECRET and ADMIN_PASSWORD
npm install
npx wrangler d1 migrations apply nrcga-cms --local
npm run seed
npm run dev
```

- API: http://localhost:8787
- Admin: http://localhost:8787/admin
- Login: `ADMIN_EMAIL` from wrangler vars + `ADMIN_PASSWORD` from `.dev.vars`

## Deploy

All Workers, D1, and R2 resources live under the **Nrcga.it@gmail.com** Cloudflare account (`account_id` in [`wrangler.jsonc`](wrangler.jsonc)).

Pushing to GitHub **does not** deploy the Worker by itself. Either connect the repo in Cloudflare (below) or run `wrangler deploy` manually.

### Deploy from Git (recommended)

Connect this monorepo so merges to `main` deploy automatically.

**Production Worker (`nrcga-api`)**

1. Cloudflare dashboard → **Workers & Pages** → **nrcga-api** → **Settings** → **Builds** (or **Connect to Git**).
2. Connect **`nrcgait/nrcga-website-frontend`**.
3. Build settings:

| Setting | Value |
|---------|--------|
| Production branch | `main` |
| Root directory | `api` |
| Build command | `npm ci && npm run check` |
| Deploy command | `npx wrangler deploy --env=""` |

4. Confirm bindings match [`wrangler.jsonc`](wrangler.jsonc): D1 `nrcga-cms`, R2 `nrcga-media`, rate limiters, `EMAIL`, and `ASSETS`.
5. Set secrets once in the dashboard (or via CLI): `JWT_SECRET`, `ADMIN_PASSWORD` with `--env=""`.
6. Attach custom domain **`api.nrcga.org`** under **Custom domains**.

**`--env=""` explained:** [`wrangler.jsonc`](wrangler.jsonc) defines a root (production) config and a named `staging` environment. `--env=""` targets the **root/production** Worker (`nrcga-api`). Use `--env staging` for the staging Worker (`nrcga-api-staging`).

**Staging Worker (`nrcga-api-staging`)**

Use a separate Worker project (or separate build environment) with:

| Setting | Value |
|---------|--------|
| Root directory | `api` |
| Build command | `npm ci && npm run check` |
| Deploy command | `npx wrangler deploy --env staging` |

Staging D1/R2 bindings are under `env.staging` in [`wrangler.jsonc`](wrangler.jsonc).

**Static site (Cloudflare Pages)**

The public HTML site is separate from the API Worker. Connect the same repo to a **Pages** project (or deploy manually):

- **Production:** point Pages at the repo root; output is the static files at the project root.
- **Staging (manual):** `npx wrangler pages deploy . --project-name nrcga-website-staging --branch main --commit-dirty=true` from the repo root.

**What Git deploy does not run**

Schema changes and seed data still require manual steps when needed:

```bash
cd api
# Production
npx wrangler d1 migrations apply nrcga-cms --remote --env=""
node scripts/seed-from-repo.mjs --remote

# Staging
npx wrangler d1 migrations apply nrcga-cms-staging --remote --env staging
npm run seed:staging
```

### Manual deploy (CLI)

Use when Git builds are not connected, or you need an immediate one-off deploy.

#### Staging (test environment)

```bash
cd api
npx wrangler d1 migrations apply nrcga-cms-staging --remote --env staging
npm run seed:staging
npm run deploy:staging
cd ..
npx wrangler pages deploy . --project-name nrcga-website-staging --branch main --commit-dirty=true
```

- **API:** https://nrcga-api-staging.nrcga-it.workers.dev
- **Admin:** https://nrcga-api-staging.nrcga-it.workers.dev/admin
- **Frontend:** https://nrcga-website-staging.pages.dev (latest preview URL shown after `pages deploy`)

#### Production

1. D1 `nrcga-cms` and R2 `nrcga-media` are configured in [`wrangler.jsonc`](wrangler.jsonc).
2. Secrets: `npx wrangler secret put JWT_SECRET --env=""` and `npx wrangler secret put ADMIN_PASSWORD --env=""`.
3. Route `api.nrcga.org/*` to the Worker (Cloudflare dashboard → Workers → `nrcga-api` → Custom domains).
4. `npx wrangler d1 migrations apply nrcga-cms --remote`
5. `node scripts/seed-from-repo.mjs --remote`
6. `npm run deploy` (or `wrangler deploy --env=""`)

- **API (workers.dev):** https://nrcga-api.nrcga-it.workers.dev
- **API (production hostname):** https://api.nrcga.org (after custom domain is attached)
- **Admin:** `/admin` on either hostname above

Public JSON GETs send `Cache-Control: public, max-age=60` (no KV cache layer — fine for chapter traffic).

## Rate limiting

Cloudflare Workers Rate Limiting bindings (per colo, per key):

- **Staff login** (`POST /admin/login`): 8 attempts / 60s per IP and per email
- **Public writes** (`POST /api/v1/*`): 20 requests / 60s per IP (forms, event registration)

Exceeded requests return **429** with `Retry-After: 60`. Staging uses separate namespace IDs so it does not share counters with production.

## Pages editor

CMS pages use a rich-text editor (same toolbar model as posts) with insertable blocks: Image, Button, Callout, Embed, Spacer. Content is stored in `pages.body_html`. The home page (`slug=home`) also stores hero and contact copy in `pages.regions_json`. Legacy `body_json` remains as a read fallback until pages are re-saved.

## Public site

Set on Cloudflare Pages (or in HTML):

```html
<script>window.NRCGA_API_BASE = 'https://api.nrcga.org';</script>
<script src="js/api-client.js"></script>
```

Loaders fall back to local CSV when the API is unavailable.

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

### Staging (test environment)

```bash
cd api
npx wrangler d1 migrations apply nrcga-cms-staging --remote --env staging
npm run seed:staging
npm run deploy:staging
cd ..
npx wrangler pages deploy . --project-name nrcga-website-staging --branch feature/cloudflare-cms-backend --commit-dirty=true
```

- **API:** https://nrcga-api-staging.thefieldmappinggroup.workers.dev
- **Admin:** https://nrcga-api-staging.thefieldmappinggroup.workers.dev/admin
- **Frontend:** https://nrcga-website-staging.pages.dev (latest preview URL shown after `pages deploy`)

## Production

1. Create D1 database `nrcga-cms` and R2 bucket `nrcga-media` in the Cloudflare dashboard (or `npx wrangler d1 create nrcga-cms`).
2. Put the real `database_id` in [`wrangler.jsonc`](wrangler.jsonc) (replace `local-dev-placeholder`).
3. Set secrets: `npx wrangler secret put JWT_SECRET` and `npx wrangler secret put ADMIN_PASSWORD`.
4. Route `api.nrcga.org/*` to this Worker.
5. `npx wrangler d1 migrations apply nrcga-cms --remote`
6. `npm run seed` against remote (or seed staging first, then promote).
7. `npm run deploy`

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

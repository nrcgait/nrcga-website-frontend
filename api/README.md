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

### Production

1. Create D1 database and R2 bucket in Cloudflare dashboard
2. Update `database_id` in `wrangler.jsonc`
3. Set secrets: `JWT_SECRET`, `ADMIN_PASSWORD`
4. Route `api.nrcga.org/*` to this Worker
5. `npx wrangler d1 migrations apply nrcga-cms --remote`
6. `npm run deploy`

## Public site

Set on Cloudflare Pages (or in HTML):

```html
<script>window.NRCGA_API_BASE = 'https://api.nrcga.org';</script>
<script src="js/api-client.js"></script>
```

Loaders fall back to local CSV when the API is unavailable.

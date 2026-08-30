# NRCGA Website README

Static multi-page public site plus a **Cloudflare Worker CMS** in `api/` (Hono + D1 + R2). Staff edit content at `/admin` without redeploying HTML for CMS-backed pages and lists.

## Architecture

| Layer | Role |
|-------|------|
| **Cloudflare Pages** | Static HTML/CSS/JS (`*.html`, `js/`, `css/`, `assets/`) |
| **Cloudflare Worker** (`api/`) | Public `/api/v1/*`, staff portal `/admin`, D1 content, R2 media, native forms |

Public pages load `js/api-client.js` and entity loaders. If the API is down, many list loaders still fall back to CSV under `data/`.

## Staff portal (editable without deploy)

- Site settings (logo, theme, contact, footer, breaking news)
- Navigation, carousel, programs, archive, Q&A, zero damages
- Block-based pages, leadership, committees, resources, membership types
- Rich posts, events/registrations, assets
- Form inboxes (contact, applications, training, newsletter CSV export)
- Profile password change

See **`api/README.md`** for local Worker setup, Git-connected Cloudflare deploys, and manual CLI deploy. See **`MANAGEMENT.md`** for ops notes (CSV fallback still documented).

## Local development

**Public site** (port 8000):

```bash
python -m http.server 8000
```

**API / admin** (port 8787):

```bash
cd api
cp .dev.vars.example .dev.vars
npm install
npx wrangler d1 migrations apply nrcga-cms --local
npm run seed
npm run dev
```

Open http://localhost:8000 with API at http://localhost:8787 (default in `js/api-client.js` for localhost).

## Native forms

Contact, membership application, award nomination, training request, and training sign-in post to `POST /api/v1/forms/:type` and appear under **Admin → Inboxes**. Newsletter subscribers are stored in D1 with CSV export.

## Custom CMS pages

Create a page in admin with **Custom page** checked. Public URL: `page.html?slug=your-slug`.

## Production

1. Create production D1 + R2; set `database_id` in [`api/wrangler.jsonc`](api/wrangler.jsonc)
2. Secrets: `JWT_SECRET`, `ADMIN_PASSWORD`
3. Connect the repo to Cloudflare for automatic Worker deploys on `main` (see **`api/README.md`**), or apply migrations + seed + `npm run deploy` in `api/` manually
4. Point `api.nrcga.org` at the Worker; deploy Pages for the static site

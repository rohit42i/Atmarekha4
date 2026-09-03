# Atma Rekha

Production Vite/React frontend for the Atma Rekha manga site.

## Stack
- React 18
- Vite 6
- Tailwind CSS
- Supabase (database, auth, and public media URLs)
- Cloudflare Workers Static Assets

## Architecture

```text
Browser
  ↓
Cloudflare Workers Static Assets
  ↓
Vite/React app
  ↓
Supabase
  ├─ chapters
  └─ chapter_pages
```

The browser does not use a separate Express/Node/MongoDB/Cloudinary backend. Public chapter metadata and manga page URLs come directly from Supabase.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

Cloudflare serves the generated `dist/` directory and `wrangler.toml` enables SPA fallback.

## Supabase environment variables

Set these in the deployment environment. Never commit real credentials:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_ANON_KEY` is supported only as a legacy fallback

Never put a Supabase service-role or secret key in Vite environment variables.

## Supabase chapter schema

### `chapters`

- `id` — uuid
- `Chapter Number` — bigint
- `Title` — text
- `Description` — text
- `Cover url` — text
- `status` — text
- `Release date` — timestamptz
- `Created at` — timestamptz

### `chapter_pages`

- `Chapter id` — uuid
- `Page number` — bigint
- `Image url` — text
- `Created at` — timestamptz

The frontend reads these records live through the Supabase Data API. Chapter/page public read access is controlled by Supabase RLS policies.

## Cloudflare

`wrangler.toml` is configured for Cloudflare Workers Static Assets:

- build output: `dist/`
- SPA fallback: enabled

The GitHub build workflow runs `npm ci` and `npm run build` on pushes and pull requests to `main`.


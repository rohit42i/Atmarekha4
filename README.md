# Atma Rekha

Production Vite/React frontend for the Atma Rekha manga site.

## Stack
- React 18
- Vite 6
- Tailwind CSS
- Supabase
- Cloudflare Workers Static Assets

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

Cloudflare uses `dist/` as the static asset directory and is configured for SPA fallback in `wrangler.toml`.

## Supabase environment variables

Set these in the deployment environment (never commit real secrets):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`

The frontend reads live chapter metadata from the `chapters` table and chapter page URLs from `chapter_pages`.

### Expected chapter columns

- `id`
- `Chapter Number`
- `Title`
- `Description`
- `Cover url`
- `created_at` (optional)

### Expected chapter page columns

- `Chapter id`
- `Page number`
- `Image url`

Do not commit `.env.local` or other files containing credentials.

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

## Architecture and quality checks

The incremental folder migration, API compatibility rules, public environment
policy, and remaining refactor stages are documented in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

Run the focused quality gate before opening a pull request:

```bash
npm run quality:check
npm run check
npm run build
```

Run `npm run hooks:install` once in a local clone to enable the pre-commit
quality gate. Strict type checking currently covers the newly migrated shared
modules; expanding it across legacy root components is a separate migration step.
## Quality checks

Use Node.js 24 for local checks. Run the complete gate before opening or merging a change:

```bash
npm ci
npm run quality:check
npm audit --omit=dev --audit-level=high
npm run check
npm run build
```

The quality gate runs ESLint, the configured strict TypeScript boundary, Prettier, unit tests, and architecture checks. Production regression checks validate sitemap, SEO metadata, security headers, and protected media-worker role rules. The current TypeScript boundary is incremental and does not yet type-check every legacy module.
### Dependency audit note

The production dependency audit must pass with no high-severity findings before release. The full development dependency tree currently retains high-severity advisories in Tailwind CSS 3's transitive build-time dependencies (braces, chokidar, fast-glob, and micromatch). source-map-js is pinned to patched version 1.2.2. npm's current automated remediation requires a Tailwind CSS 4 major upgrade; perform that as a separate, visually verified migration rather than changing the CSS toolchain silently in this compatibility-first refactor.

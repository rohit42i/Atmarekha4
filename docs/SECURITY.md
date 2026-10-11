# Security posture

Last repository audit: 2026-10-11.

## Controls in the repository

- Only browser-safe settings belong in `VITE_*` configuration. Supabase publishable keys are public identifiers, not authorization controls. Service-role keys, Razorpay secrets, Cloudflare API tokens, and SMTP credentials must stay in Supabase/Worker secret storage.
- Admin components check the authenticated user's `admins.role`; the Atma media, PdPL media, and analytics Workers also authorize only explicit `owner` or `admin` roles. Database Row Level Security and server-side checks remain the actual security boundary.
- Static response headers define CSP, HSTS, anti-framing, content-type sniffing protection, a referrer policy, and route-level `X-Robots-Tag` directives. The inline theme bootstrap is authorized by a SHA-256 CSP hash rather than a broad inline-script allowance.
- Password login uses the existing server-side rate-limited flow. New-password validation sends only the first five SHA-1 hash characters to the Have I Been Pwned range service; it does not send the full password or full digest.

## Verification commands

Run these from the repository root:

```sh
npm ci
npm run quality:check
npm audit --omit=dev --audit-level=high
npm run check
npm run build
```

The verified CI run on 2026-10-11 reported **0 vulnerabilities in production dependencies**, and the architecture, typecheck, formatting, unit tests, static checks, and production build passed.

## Remaining development-tool advisory

The full development dependency audit still reports the high-severity `braces` advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) through the Tailwind CSS 3 build-tool dependency tree. The upstream `braces` package had no compatible patched release as of this audit date. The other patched selector-parser advisory was addressed by locking `postcss-selector-parser` to 7.1.6.

Do **not** run `npm audit fix --force` as an automatic production fix: npm proposes a Tailwind CSS major-version change. Tailwind 4 migration must be separately reviewed and visually/regression-tested before adoption. The remaining `braces` finding is development/build tooling, not a vulnerable package in the production dependency graph, but it is still tracked rather than hidden.

## External checks still required

GitHub checks cannot confirm account-level settings or field performance by themselves. Before calling the live site fully audited, review the Supabase project settings and RLS policies, rotate any secret found in Git history, verify Google Search Console ownership and sitemap processing, and measure live Core Web Vitals/Lighthouse on real routes and mobile devices.

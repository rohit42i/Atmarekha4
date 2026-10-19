# SEO, Security, Scalability and UX Audit — 19 October 2026

## Scope and evidence

Reviewed the active React/Vite application, Cloudflare Workers Static Assets Worker, response-header rules, sitemap generator, authentication/storage wrappers, analytics Worker, public feedback flow, Supabase migration/function samples, verification script and GitHub Actions build workflow. This is a source-code audit, not a penetration test or a live crawl of Googlebot. The production Supabase policies, Cloudflare zone settings, Search Console account, DNS and real-user Core Web Vitals were not accessible as verified runtime evidence. A history-aware Gitleaks scan was run separately and its findings are documented below.

**Deployment decision:** keep GitHub Actions + Cloudflare Workers/Static Assets + R2 + Supabase. Do not migrate to Vercel or add Redis/Kubernetes without evidence that the present platform is the bottleneck.

**Validation checkpoint:** on implementation revision `96d75b7aa5a4cd0112f7d206dd9f81d6da11f891`, the GitHub Actions production build/regression tests, CodeQL analysis, and historical Gitleaks scan all passed. The PR remains draft and unmerged; deploy steps were skipped for the pull-request event. Documentation and print-style refinements are being added separately, so rerun CI after the latest changes.

## Findings and status

Legend: **Present** means visible in source; **Partial** means some protections/features exist but broader proof is missing; **Missing / follow-up** means not completed in this change.

### 1. SEO and indexing

| Checklist item | Status | Finding / action |
|---|---|---|
| Server-side rendering | **Missing / architecture work** | The application entry uses React `createRoot`; the response Worker currently changes metadata and JSON-LD around a static SPA shell, not the rendered React body. Full SSR is not a safe one-file switch: several components touch `window`, `document`, storage and browser APIs during render/effects. Plan and test an explicit SSR/SSG architecture before claiming SSR. |
| Automatic sitemap | **Present** | `scripts/generate-sitemap.mjs` runs in the build lifecycle, includes public static routes and can load published chapter URLs from Supabase. Build-time credentials/environment must be present for fresh dynamic chapter data. |
| Submit to Google Search Console | **External gate** | Requires an authenticated Search Console property owner. No submission is claimed. After deployment, inspect sitemap status and URL Inspection there. |
| robots.txt / Googlebot access | **Present** | `public/robots.txt` allows crawling and advertises the sitemap. Private/admin URLs are intentionally marked `noindex` by response headers; do not remove those directives globally. Production edge/DNS behavior still needs live verification. |
| Remove `noindex` | **Intentional exceptions** | Public routes should be indexable; admin, profile, membership, community and error routes should stay out of indexes. A blanket removal would be a security/privacy regression. |
| Redirect chains | **Partial** | Worker code canonicalizes HTTP and the bare domain to HTTPS + `www` in one 301. Redirects configured outside this Worker (DNS/Cloudflare rules/other paths) have not been crawled end-to-end. |
| Correct 404s | **Implemented; Build and CodeQL passed at code commit `6491e22`; live verification remains open** | Unknown SPA routes already return 404. The PR makes a syntactically valid chapter URL return a real 404 when published-chapter metadata confirms it does not exist, instead of serving a soft 404. Metadata-fetch outages remain fail-open so a temporary backend outage does not masquerade as a confirmed missing chapter. |
| Canonical tags | **Present** | Base HTML and Worker/React routing set canonical URLs; chapter and language variants add language alternates. Need a live crawl to find any conflicting query-string or edge rule cases. |
| Optimized descriptions | **Present / review periodically** | Static routes and chapter pages have route-specific metadata. Search snippets and duplicate descriptions have not been checked against a current full crawl. |
| One H1 per page | **Partial** | Reviewed About page uses one page-level H1. No automated DOM audit covering every conditional route and modal was run. |
| FAQ schema | **Implemented; Build and CodeQL passed at code commit `045a2df`; runtime/device review remains open** | Shared FAQ content is rendered as accessible expandable HTML and emitted as `FAQPage` JSON-LD on the About page, both at the Worker response layer and the client SEO graph. Structured data does not guarantee a Google rich result. |
| Breadcrumbs | **Partial / present** | BreadcrumbList structured data is generated for chapter routes and client-side routes. A full check of visible breadcrumb UI and valid breadcrumb items for every route remains open. |
| Orphan pages / internal links | **Partial** | Public routes are listed in the sitemap and footer navigation exists. No automated link graph/crawler has proven that every indexable URL has a crawlable internal inbound link. A sitemap alone does not fix orphaning. |
| Alt text | **Partial** | Reader page images and many component images have labels; intentional decorative images use empty alt text. A project-wide rendered-DOM audit is not complete. |
| Convert all images to WebP | **Not done** | Converting every source blindly can damage transparent art, animated assets and manga linework. Preserve source artwork; create and validate WebP/AVIF derivatives for eligible public images in a separate media pipeline. |
| CLS / load under 2 seconds | **Not measured** | Asset caching/preloading exists, but no reliable mobile/desktop Lighthouse run or field Core Web Vitals evidence is attached. A <2-second guarantee cannot be inferred from code. |
| Placeholder content, author bio, authority/backlinks | **Partial / external** | The About page identifies Arkesh and describes the original series and AI-assisted production. A fuller factual author bio needs creator-supplied details. Backlinks (including Forbes) must be earned through legitimate coverage; code cannot manufacture authority or guarantee rank one. |

### 2. Security and backend hardening

| Checklist item | Status | Finding / action |
|---|---|---|
| API keys / secrets | **Partial** | Frontend Supabase publishable/anon keys and service URLs are public client configuration, not service-role secrets. Reviewed Edge Function samples read service-role keys from server environment. This review did not scan all history for every possible secret. |
| Ignore local `.env` files | **Implemented; Build and CodeQL passed at code commit `045a2df`; live verification remains open** | `.gitignore` is widened to ignore `.env*` while explicitly allowing `.env.example`. This prevents accidental future tracking but does not remove any historically leaked secret. |
| Dependency vulnerabilities | **Follow-up required** | CI reports **0 production dependency vulnerabilities**, but the full development dependency audit reports **7 findings (2 moderate, 5 high)** through the Tailwind CSS v3 toolchain, including `braces` and `postcss-selector-parser`. The automatic fix proposes Tailwind CSS v4 as a breaking change; do not run `npm audit fix --force` blindly. Resolve with safe overrides/upgrade plus build and visual regression tests. |
| No hardcoded secrets | **Partial** | No service-role key was seen in the sampled active paths. Historical secret scanning and a complete repository-wide credential inventory remain required. Rotate any confirmed exposed credential immediately. |
| Authentication | **Present / partial proof** | Supabase Auth, session helpers, MFA components and authenticated Edge Function flows exist. The audit did not prove every route through live adversarial requests. |
| Server-side authorization / user IDs | **Partial** | Admin role checks and privileged server functions exist; database policies and auth checks also appear in migrations. Every endpoint needs an explicit caller-identity/role/ownership review; client-side guards never count as the security boundary. |
| User-data isolation / database permissions | **Partial** | RLS and permission-hardening migrations are present, including protected service-only functions. Live policy state and cross-account IDOR tests were not available; verify deployed migrations and test with two unrelated accounts. |
| Firebase rules | **Not applicable from reviewed architecture** | This codebase uses Supabase and Cloudflare R2/Workers; a Firebase security-rule surface was not identified in the reviewed project. |
| Admin routes | **Partial / present** | Admin authentication/role checks and MFA-related components exist; route noindex is also configured. Hiding a route or nav item is not authorization, so direct API calls and role escalation still require live testing. |
| Production debug mode / error disclosure | **Partial** | Vite production sourcemaps are disabled and some server functions use generic errors. Client console diagnostics remain in source; every public endpoint's error contract has not been reviewed. |
| Server input validation / sanitization | **Partial** | Feedback validation/honeypot, server-side bounds and sanitized email handling exist in sampled functions. Validate every handler and rich-text path; client validation alone is insufficient. |
| File upload safety | **Partial** | Upload extension/MIME allowlists and size caps exist, with a dedicated media Worker. Server-side file-signature validation, decompression-bomb handling and abuse tests for every upload path are not proven by this audit. |
| SQL/NoSQL injection | **Partial** | Supabase query-builder calls and parameter binding are used in examined paths. A complete search for raw SQL, dynamic identifiers and unsafe query construction remains outstanding. |
| Login/signup rate limits | **Partial** | Server-side rate-limit RPCs and endpoint limits exist in the repo, including several public/write flows. Deployed limits for every login/signup/auth recovery endpoint need confirmation. |
| Git history secret scan | **Full-history scan passed; ongoing CI guard added** | Gitleaks v8.30.1 scanned 2,085 commits reachable from origin/main. Seven generic-api-key matches were checked: Supabase sb_publishable_ public client keys and the localStorage attribution-key label, not private credentials. Only their exact fingerprints are allowlisted. The PR-commit scan and full-main-history scan both passed on code commit 6491e22. Re-review any new findings and rotate any genuinely exposed credential. |
| Security headers / CORS | **Present / hardening gap** | Worker and static header rules define CSP, HSTS, nosniff, referrer, frame and permissions policies. CSP still allows inline styles, likely needed by existing UI; tighten only with regression testing. Edge functions have explicit origin allowlists, but every Worker/function should be checked for consistent deny behavior. |
| Untrusted-user simulation | **Partial / follow-up** | Static regression checks and CodeQL exist. A live authorization/IDOR/rate-limit/file-upload/CORS test suite has not been executed as an untrusted user. |
| Complete security simulation | **Not complete** | No claim of a full penetration test. Use a staging project with two accounts, normal user, moderator and admin roles, expired sessions, invalid uploads and rate-limit assertions. |

### 3. Scalability and performance

| Checklist item | Status | Finding / action |
|---|---|---|
| Database indexes | **Partial** | Index-creation migrations exist. Indexes should be checked against current production schema and slow-query/EXPLAIN evidence, not just migration text. |
| Caching / Redis | **Partial / currently sensible** | Static assets have long cache headers and chapter metadata uses Cloudflare caching. Redis is not configured. For the current small audience, adding Redis without cache-miss/query/latency evidence adds operational complexity without proven benefit. |
| Thousands of concurrent requests | **Not run** | Do not load-test production without an agreed window and permission. Run a controlled ramp/load test against an isolated staging deployment, measuring status codes, p95/p99 latency, rate limits, Worker errors and database saturation. |
| Vercel versus current hosting | **Intentionally unchanged** | Current Cloudflare Workers/Static Assets + GitHub Actions is already a managed edge deployment. Moving to Vercel solely because of a checklist would change deployment behavior, secrets and routing without demonstrating a benefit. |

### 4. UI/UX feature checklist

| Feature | Status | Finding / action |
|---|---|---|
| Dark mode toggle | **Present** | Theme toggle and light/dark CSS systems exist. |
| Cookie/analytics banner | **Implemented; Build and CodeQL passed at code commit `045a2df`; runtime/device review remains open** | Because the reviewed client code uses browser storage and chapter-view/UTM analytics but no `document.cookie` usage was found, the implementation is accurately labelled a privacy/analytics choice banner—not a false claim that cookie files are set. Chapter-view recording and UTM attribution require affirmative consent. |
| Search | **Present / scoped** | Chapter discovery searches chapter title/number; it is not a universal full-site search over all legal and informational copy. |
| Back-to-top | **Present** | Implemented in SiteRuntime. |
| Responsive mobile menu | **Partial** | Responsive/mobile navigation styles exist; a device-by-device interaction audit has not been completed. |
| Loading animations | **Present** | Loading UI and reader loading states exist. Check accessibility and perceived performance against real devices. |
| Hover states | **Present / partial** | CSS interaction states exist; complete contrast/keyboard-state testing remains. |
| Scroll progress | **Reader present; page indicator added in this PR** | The reader already showed chapter-page progress. A general document scroll progress indicator is added by this PR. |
| Copy button | **Partial / present** | Share/copy link behavior exists in the reader and other controls. Not every copyable value in the admin has been audited. |
| Print stylesheets | **Implemented; Build and CodeQL passed at code commit `045a2df`; runtime/device review remains open** | A dedicated print stylesheet was added. Print preview and manga page breaks still need manual browser verification. |
| Sticky headers | **Partial** | Reader header is present; site-wide sticky behavior has not been verified on every breakpoint. |
| Skip-to-content | **Present** | A skip link exists in the base HTML. |
| Password visibility | **Present / partial** | Reset-password controls have visibility toggles; every auth form should be included in the final accessibility pass. |
| UTM tracking | **Present, now consent-gated in this PR** | Existing first/last touch source capture uses localStorage; this PR stops capture until analytics consent is granted. |
| Form success/error states | **Present** | Feedback form tracks validation, errors, success and offline queuing. |
| Confirmation modals | **Partial / present** | Dialogs exist for several flows; no cross-app inventory confirmed every destructive action requires confirmation. |
| Last updated date | **Missing / avoid fabricated dates** | A reliable content-update timestamp is not consistently shown to readers. Display it only where a real source/build timestamp exists. |
| Expandable FAQ | **Implemented; Build and CodeQL passed at code commit `045a2df`; runtime/device review remains open** | Accessible native `details/summary` FAQ is rendered on the About page and paired with structured data. |
| Floating contact button | **Implemented; Build and CodeQL passed at code commit `045a2df`; runtime/device review remains open** | A mail/contact entry point is added for public pages and is hidden on detected reader, admin and private surfaces. Responsive overlap still needs manual device testing. |

### 5. Slash-command / AI framework context

The listed slash commands are prompt/workflow conventions for an AI assistant, not website product features or URL routes. They should be used as planning/review modes when appropriate, not implemented as fake controls in the public site. No slash-command parser was added.

## Changes implemented by draft PR #89

- Real HTTP 404 for confirmed-missing chapter URLs, with noindex.
- Worker SEO regression tests wired into `npm run check` and build preflight.
- Revalidate `/sw.js` rather than caching this stable URL as immutable for a year.
- Ignore all local `.env*` files except `.env.example`.
- Shared About-page FAQ copy, accessible FAQ UI and FAQPage JSON-LD in both Worker output and client metadata graph.
- Print stylesheet.
- Consent-based analytics/UTM choice, and suppression of chapter-view writes until readers grant consent.
- Site-level scroll progress indicator and a floating public contact link.
- More static regression checks for these requirements.

The code changes were validated by successful Build, CodeQL and Gitleaks workflows at commit `6491e22` on 19 October 2026. The full-history scan covered 2,085 commits reachable from main. This report-only update requires fresh workflow runs; PR #89 remains draft and unmerged, and no production deployment is claimed.

## Release gates

1. Build, CodeQL and Gitleaks passed for code commit `6491e22` on 19 October 2026. Reverify all three on the final PR head before merge.
2. Review/merge only after checking the diff and runtime behavior (especially consent UI, route handling, print CSS and chapter 404s).
3. Test the merged deployment using Google Search Console URL Inspection, sitemap status, a crawl of public routes, Lighthouse mobile/desktop and the live response headers.
4. Keep the history-aware Gitleaks job green and rotate any genuinely exposed credentials; then run live authorization/IDOR/upload/rate-limit tests.
5. Run load tests on a non-production staging environment only.


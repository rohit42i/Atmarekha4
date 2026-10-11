# Atma Rekha architecture

## Current constraints

Atma Rekha is a browser-first Vite/React application deployed as Cloudflare
Static Assets. Supabase provides authentication and database APIs; Cloudflare
Workers provide media and analytics services. There is no separate Express
server. Supabase Edge Function names and Worker paths are deployed interfaces,
so they must not be renamed or reorganized without a coordinated deployment.

The older application still has many root-level modules. The refactor is
incremental: preserve their import contracts while moving one feature at a time.
Avoid a one-shot rename of every component; that creates unnecessary risk for
the live reader, membership access, media uploads, and admin operations.

## Source layout

```text
src/
  config/                 Public browser configuration
  features/
    chapters/             Chapter retrieval and page URL compatibility
  shared/
    errors/               Safe UI error messages
    validation/           Reusable client-side input normalization
  types/                  Shared environment typings
docs/
  ARCHITECTURE.md
.githooks/
  pre-commit
supabase/
  functions/              Deployed function names are stable API contracts
  migrations/             Versioned database changes
```

The root `chapters.js` is a deliberate compatibility facade for existing
components. New code should import from feature modules; remove the facade only
after all callers have been migrated and verified.

## Boundaries and data flow

- **UI** owns rendering, local interaction state, loading, empty, and retry
  states. Components should not embed table names or raw fetch URLs.
- **Feature services** own chapter/domain mapping and data access for a feature.
  Return predictable values and throw errors for the caller to handle.
- **Shared validation** normalizes bounded text before writes. It is not a
  substitute for validation inside Supabase policies, Edge Functions, or Workers.
- **Infrastructure adapters** remain at the edge: `supabase.js` wraps the
  Supabase client and Cloudflare R2 compatibility behavior; environment values
  come from `src/config/publicEnv.js`.
- **Error presentation** uses `toUserMessage` to keep stack traces, SQL details,
  and internal service URLs out of reader-facing UI. Log diagnostics separately.

## Environment and security

Copy `.env.example` to a local environment file and configure deployment
variables in the hosting provider. Only public values belong in `VITE_*`
variables because Vite embeds them in browser assets. Supabase publishable/anon
keys are not authorization: database access still depends on RLS. Service-role
keys, Razorpay secrets, SMTP credentials, and Cloudflare API tokens must remain
in server-side secret storage.

Text inputs must be bounded and validated on both client and server. React's
normal text rendering should be preferred over injecting user content as HTML.
Do not use a frontend validator as the sole authorization or abuse-prevention
control.

## State management

Use component state for transient UI state, and existing authentication/session
services for cross-page identity. Keep server data fetching in feature services.
Do not introduce a global state library until there is a demonstrated shared
state requirement; duplicate remote caches should not be created.

## API compatibility and versioning

The existing Worker APIs already use versioned paths such as `/v1/views`,
`/v1/view`, and `/v1/admin/analytics`. Preserve those paths and use a new
version when an incompatible response or authorization contract is required.
Supabase Edge Function names are also public deployment contracts and should
remain stable. Database changes should be additive migrations with explicit
RLS review and rollback planning.

## Quality gates

- `npm run test`: deterministic unit tests using Node's built-in test runner.
- `npm run lint`: ESLint checks the migrated `src/` modules and root error
  boundary.
- `npm run typecheck`: strict TypeScript checking for the typed migration
  boundary in `jsconfig.json`. Legacy root modules are not yet all checked.
- `npm run format:check`: Prettier verifies the migrated/shared modules and
  architecture configuration files.
- `npm run check`: existing production regression checks.
- `npm run build`: sitemap generation plus the Vite production build.

Run `npm run hooks:install` once in a local clone to enable the pre-commit
quality gate. The CI workflow also runs the quality gate on pull requests.

## Remaining migration work

This first refactor establishes safe boundaries and examples rather than
claiming every legacy file is already clean. Continue by moving admin,
membership, community, and engagement logic feature by feature; extract
components from large screens only where it reduces coupling; add integration
tests around subscription authorization and media uploads; and gradually expand
strict type checking to the legacy app. Do not delete old modules or change
database/API contracts as part of a folder-only move.

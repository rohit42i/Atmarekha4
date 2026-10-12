# Supabase-to-Catalyst capability map

**Status:** Candidate mappings only; no implementation or migration is authorized by this document.

| Current capability | Verified code surface | Candidate Catalyst approach | Compatibility gap / risk | Required tests |
|---|---|---|---|---|
| Browser data access | supabase.js, chapters.js, engagement.js, pdlplEngagement.js, palDoPalKeLamhe.js and many components | Domain services calling a trusted API/functions layer; Data Store/ZCQL only for compatible entities | No drop-in PostgREST/PostgreSQL client; filters, joins, ordering, pagination, error and return shapes differ | Contract tests per operation and normalized error |
| Chapters/pages/series | chapters.js, App.jsx, AdminPanel.jsx, PalDoPalAdmin.jsx | Data Store for compatible entities; Functions for compound admin mutations | Not PostgreSQL; foreign-key, unique, index, query, transaction and column semantics must be checked | Language variants, publication/access rules, stable order and atomic page management |
| Profiles and membership | supabase.js, ProfileV2.jsx, PublicProfile.jsx, Membership.jsx | Data Store + trusted membership/identity functions | Stable identity IDs and entitlement calculations required; no client-trusted plan values | Active, expired, duplicate and multiple subscription states; owner/private profile checks |
| Auth and sessions | UserAuth.jsx, AuthGate.jsx, adminAuth.js, MfaGate.jsx, SecuritySettings.jsx | Catalyst Authentication or approved third-party IdP | PKCE, session refresh, URL code exchange, UUID mapping, TOTP MFA and account recovery parity not proven; password-hash import not assumed | Sign-up/login/logout/reset, expiry/revocation, MFA challenge/step-up, identity recovery and duplicate-email handling |
| RLS and resource authorization | Migration SQL policies; direct client table calls | Data Store scopes/permissions, API Gateway/security rules and server-side authorization | Not equivalent to PostgreSQL RLS. UI checks do not form a security boundary | Anonymous/owner/other-user/member/admin/unpublished-resource allow-deny matrix |
| SQL RPCs / atomic mutations | replace_chapter_pages, pdlpl page operations, pdlpl_upsert_chapter, rate limit and password login RPCs | Catalyst Advanced I/O/Node.js Functions, if equivalent validation and transaction behavior can be demonstrated | PL/pgSQL cannot be presumed portable; locking/transactions/atomicity unverified. If necessary, use a compatible PostgreSQL target or approved hybrid | Concurrency, partial failure, retry/idempotency and simultaneous admin writes |
| Triggers and derived aggregates | Migration-defined timestamps, rate limits, user-badge sync, engagement count/summary maintenance | Explicit Functions/event-driven processing with proven consistency | Signals/Event Functions are not automatically synchronous SQL triggers; eventual consistency may differ | Duplicate/reordered events, concurrent updates, delete cleanup and aggregate reconciliation |
| Comments/reports/ratings/likes | engagement.js, EnhancedComments.jsx, pdlplEngagement.js | Data Store + secure Functions; separate real-time transport | Ownership, parent comments, report workflow, summaries and filtered live updates need porting | CRUD, moderation, ownership, limits, ordering and live-update contract |
| Group chat and presence | GroupChat.jsx | Data Store + Functions, with separately verified WebSocket/SSE/realtime design | Signals is an event bus, not demonstrated browser subscription or Presence parity | Reconnect, replay, stale presence, duplicate/out-of-order events and authorization |
| Community | Community.jsx, CommunityAdmin.jsx, CommunityPage.jsx | Data Store + Functions | Member-only/private visibility and moderation policies need explicit mapping | Revoked membership, owner spoofing, hidden post access and moderation |
| Admin/moderation/audit | AdminPanel.jsx and Admin* modules, adminAuth.js | Server-side Functions/roles with resource-level authorization | Broad current access relies on RLS and several database functions; new endpoints must preserve audit and authorization | Role matrix, admin-only operations, audit logs and denied direct calls |
| Privacy consent/deletion | PrivacyCenter.jsx; DPDP tables | Data Store + authenticated Functions | dpdp-data-rights source not tracked in main; propagation and retention unknown | Request ownership/status, idempotency, audit and deletion dependencies |
| Razorpay payments/subscriptions | RazorpayCheckoutButton.jsx, Membership.jsx and six Razorpay-related tracked functions | Catalyst Functions/API Gateway are possible only in a separately authorized workstream | Preserve webhook signature verification, idempotency, subscription states, rate limits and entitlement consistency; no payment change in this task | Invalid signature, replay, duplicate webhook, cancellation race, recovery and reconciliation |
| Push registration | notification-fix.js, register-push-subscription | Catalyst Function candidate | Web Push lifecycle, ownership, existing limits and delivery implementation are not fully captured | Subscribe/update/unsubscribe, invalid endpoint, own-resource access and rate limit |
| Nine tracked Supabase Edge Functions | supabase/functions/* | Catalyst Node.js Advanced I/O Functions and API Gateway/security rules | Deno-to-Node, CORS, request/response, secrets, timeouts and logging differ. Catalyst docs say Integration Functions are unavailable in IN/EU/AU/CA data centers | Contract/auth/CORS/timeout/retry/secret tests; verify data center and runtime |
| Cloudflare media/R2 | cloudflareR2 in supabase.js, pdlplR2.js and existing media Workers | Keep current Cloudflare Workers/R2 unchanged. Stratus is only a separately approved storage option | Current URLs, object keys and auth token validation differ from Stratus permissions/signed URLs | Regression tests only in a non-production environment if separately authorized |
| Analytics/views | engagement.js, analytics-worker/worker.js, related SQL migration | Keep Cloudflare analytics; consider alternate service only after explicit design | Database and Worker storage are split; don't assume all views live in Postgres | Date-window/count reconciliation, retries, rate limits and outage handling |
| Build/config | .env.example, wrangler.toml, worker.js, .github/workflows/build.yml | Per-environment server-side config and future gated CI changes | Vite variables are public; current push-to-main workflow has infrastructure/deploy steps | No secrets in browser bundle; PR path demonstrably does not deploy |

## Candidate platform documentation

- [Catalyst Data Store columns and constraints](https://docs.catalyst.zoho.com/en/cloud-scale/help/data-store/columns/) and [tables](https://docs.catalyst.zoho.com/en/cloud-scale/help/data-store/tables/): Catalyst-specific type, relationship and constraint model.
- [ZCQL SELECT](https://docs.catalyst.zoho.com/en/cloud-scale/help/zcql/select/): Catalyst query syntax; one SELECT query is documented to return at most 300 rows, so pagination and checkpoints need tests.
- [Catalyst Authentication](https://docs.catalyst.zoho.com/en/cloud-scale/help/authentication/introduction/): user and role management, password reset and hosted/embedded/third-party auth choices; does not establish parity for this app's MFA/session or hash-transfer needs.
- [Catalyst Functions](https://docs.catalyst.zoho.com/en/serverless/help/functions/introduction/) and [Security Rules](https://docs.catalyst.zoho.com/en/serverless/help/security-rules/introduction/): candidate server-side processing and endpoint access controls. Integration Functions are documented as unavailable in IN, EU, AU and CA data centers.
- [Catalyst Signals](https://docs.catalyst.zoho.com/en/signals/getting-started/introduction/): event bus/publishers/targets; not proof of browser Postgres-change or Presence parity.
- [Stratus permissions](https://docs.catalyst.zoho.com/en/cloud-scale/help/stratus/stratus-permissions/): public/authenticated bucket templates; not equivalent to RLS or the current media Worker authorization model.

## Not verified as drop-in equivalents

PostgreSQL-compatible DDL/PLpgSQL, live RLS policy behavior, transactional page replacement, synchronous trigger semantics, TOTP MFA and session-token continuity, filtered browser Realtime/Presence, password-hash migration, the four UI-invoked but untracked function contracts, and Cloudflare Worker trust behavior all remain unresolved.

For requirements that depend on PostgreSQL-specific SQL, transactions, locking or policy behavior, evaluate a compatible PostgreSQL target or approved hybrid architecture. Do not force a schema into Catalyst Data Store without a verified fit.

## Live-state constraints added after read-only discovery

- Supabase currently has 59 public tables, 145 public RLS policies, 55 SQL functions across public/private schemas (36 marked `SECURITY DEFINER`), 46 user triggers across public/storage, and five publication tables in `supabase_realtime`. The mapping must preserve these server-side contracts, not just client CRUD.
- There are 16 active deployed Supabase Edge Functions. Seven live handlers have no tracked source folder on `main`; their code/contracts must be recovered and reviewed before their responsibilities can be ported.
- The live DB reports 180 migration-history entries compared with 65 tracked SQL files. Reconcile the ledger and live schema before generating target DDL or attempting migration automation.
- The connected Catalyst account is in the India data center, but no dedicated Atma Rekha project was identified. The discovered Catalyst capabilities include Datastore/ZCQL, Functions, API Gateway and Authentication. No target resources were created. Confirm region, data residency, pricing/quota and create an isolated project through the console before any implementation.
- Do not treat Catalyst Datastore/ZCQL as PostgreSQL-compatible by assumption. Explicitly redesign multi-row atomic writes, unique/foreign-key/check enforcement, SECURITY DEFINER routines, RLS-equivalent ownership rules, auth session/MFA, Realtime publication/Presence, Storage access and Razorpay webhook processing.


## Additional live-state constraints — 12 October 2026

The live Supabase inventory confirms 59 public tables, 145 public RLS policies, 55 SQL functions across public/private (36 marked `SECURITY DEFINER`), 46 user triggers across public and Storage, and five tables in the Realtime publication. A provider boundary must preserve these server-side contracts, not only browser CRUD.

Live Supabase has 16 active deployed Edge Functions; seven do not have same-named tracked source folders on `main`. Recover and review those handlers before mapping behavior into Catalyst. The gateway `verify_jwt` flag is not a substitute for inspecting each handler's actual authorization or webhook-signature checks.

The migration ledger has 180 live entries versus 65 tracked migration SQL files; raw normalized-name matching found 51 matches, 129 live entries without same-named tracked files and 14 tracked names without same-named live entries. Reconcile semantically before target schema creation or migration execution.

The connected Catalyst org is in the India data center, but discovery did not find a project clearly dedicated to Atma Rekha. The tool catalog includes Datastore/ZCQL, Functions, API Gateway and Authentication, which are only candidate building blocks. It does not establish parity for PostgreSQL transactions/constraints/RLS, Supabase Auth sessions/MFA, Realtime database change feeds/Presence, Storage object policies or Cloudflare/Razorpay workflows. Do not repurpose an unrelated Catalyst project.

## Verified Catalyst Development scaffold (12 October 2026)

The dedicated project `Atmarekha` (`81164000000013050`, Development) now contains 61 mapped Data Store tables and 411 source-mapped fields. Field presence was verified against all 61 source table definitions. `CATALYST-SCHEMA-MAP.csv` records the exact target table IDs, mapped names, source defaults/checks/FK references and conversion notes.

The initial table permission model is intentionally closed: `App Administrator` has SELECT/INSERT/UPDATE/DELETE, while `App User` has no table operations. Catalyst hosted/embedded/third-party Auth remains disabled; API Gateway is disabled; no functions, routes or CORS domains exist. Do not loosen permissions or enable endpoints until a trusted server-side authorization layer is deployed and tested.

**Validated limitations:** Data Store columns alone do not reproduce PostgreSQL RLS, FK actions, CHECK constraints, defaults, PL/pgSQL RPCs, triggers, multi-column uniqueness or transaction behavior. `uuid` is stored as source-preserving text; `numeric`, arrays and JSONB need lossless text serialization/validation; composite keys require a deterministic `source_pk`. This scaffold does not prove runtime parity. Three clearly labeled synthetic, unpublished rows were inserted and read back for a basic smoke test; no production data was imported. See `CATALYST-STAGING-STATUS.md`.

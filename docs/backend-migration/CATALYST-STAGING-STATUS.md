# Catalyst development staging status

**Snapshot:** 12 October 2026 (Asia/Kolkata)  
**Purpose:** Prepare an isolated Catalyst staging target for a later, separately authorized migration.  
**Migration status:** NOT READY for real data or cutover.

## Verified target

- Zoho Catalyst organization: `60091620701` (India data center).
- Project name: `Atmarekha`.
- Project ID: `81164000000013050`.
- Environment: `Development` (active).
- Domain: https://atmarekha-60091620701.development.catalystserverless.in
- Existing projects `Polls` and `Project-Rainfall` were not modified.

## Datastore work completed

- 61 source tables inventoried: 59 in `public` and 2 in `private`.
- 61 corresponding Catalyst Data Store table containers created.
- 411 source fields mapped and created across these target tables.
- The created columns were re-listed and compared table-by-table against the source metadata. All expected fields were found after documented name mappings; two extra `source_pk` fields were added to support deterministic upserts for the two composite-primary-key tables.
- UUID columns are stored as `varchar(36)` to preserve source identifiers. Catalyst-generated `ROWID` must not be used as a replacement for application UUIDs.
- Source private tables are named `private_feedback_rate_limits` and `private_dpdp_breach_incidents`.
- A source/target mapping manifest with target table IDs, columns, types and conversion notes is available in [CATALYST-SCHEMA-MAP.csv](./CATALYST-SCHEMA-MAP.csv).

## Access controls applied

- Table permissions were set for all 61 tables to allow the Catalyst `App Administrator` role `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
- The Catalyst `App User` table permission list was set to empty on all 61 tables. A follow-up permission read confirmed this on multiple representative sensitive and ordinary tables, including `chapters`, `payments` and `private_dpdp_breach_incidents`.
- This deliberately blocks the default end-user table access until a trusted authorization/function layer is implemented and tested.

## Not completed / explicit blockers

1. **Authentication remains disabled**: hosted, embedded and third-party auth are all off; public signup is off.
2. **API Gateway remains disabled**. No routes were created.
3. **Zero serverless functions exist**. The connected Catalyst MCP exposes read/list/update/execute/delete operations but not function-source creation/upload/deployment. Functions must be created from the Catalyst console/CLI and reviewed code, without deployment to production.
4. **Storage buckets are not created.** Stratus operations returned a first-use-session requirement. The owner must open Stratus/Storage in the Catalyst console once, after which protected/encrypted development buckets can be created.
5. No CORS origins, email domains, payment configuration, webhooks, schedules, realtime transport or background jobs were created.
6. Catalyst Data Store is not PostgreSQL. Defaults, multi-column unique keys, composite primary keys, foreign-key enforcement, CHECK constraints, indexes, transactions, triggers, RLS policies and PL/pgSQL functions have not been automatically reproduced. The manifest documents conversions; application-layer constraints and test suites are still required.
7. Array/JSONB/numeric conversions require special handling: JSON values are serialized as text with size validation; exact numeric values must remain decimal strings to avoid floating-point changes.
8. Realtime chat/presence, identity continuity/MFA, Cloudflare R2/Workers, membership entitlements, Razorpay webhook/idempotency behavior and privacy-deletion workflows remain unimplemented and require their own compatibility/acceptance tests.
9. The live source migration ledger and tracked SQL migrations still require semantic reconciliation; seven deployed Supabase Edge Function sources are not tracked on `main`.

## Safety ledger

- Read-only schema metadata was inspected in the source Supabase project `pbukwjokgkqacaphlqzm`; no source data rows, user payloads, auth records, payment records or secrets were copied.
- Only three deliberately synthetic, unpublished smoke-test rows were inserted and read back successfully (one test series, one draft chapter and one page with an `example.invalid` image URL). They contain no real user/content/payment data. No production rows were imported.
- No changes were made to production Supabase, Cloudflare, Razorpay, the live website, or the main runtime code.
- Catalyst Development table containers and table permissions were created/updated only in project `81164000000013050`.
- No API routes, authentication providers, functions, storage buckets or deployments were enabled.
- A basic synthetic Data Store insert/read-back smoke test passed for `manga_series` → `chapters` → `chapter_pages`. No full contract/security test suite, local build, backup restore or rollback rehearsal has been run.

## Readiness decision

The project is **schema-staged, not migration-ready**. Do not provide real production data or change client routing yet. Continue only after Stratus first-use initialization, a function deployment workflow is available, the full compatibility layer is implemented, contracts and security tests pass, backup/restore and rollback are rehearsed, and a separate migration/cutover command is explicitly provided.


## Synthetic smoke-test fixtures

The only rows currently present are deliberately synthetic and unpublished:

- Series slug: `migration-smoke-test-20261012`; UUID `9b2f2d4a-4b8b-4c9a-9d91-000000000114`.
- Draft chapter UUID: `9b2f2d4a-4b8b-4c9a-9d91-000000000115`, linked using the preserved UUID string.
- Page UUID: `9b2f2d4a-4b8b-4c9a-9d91-000000000116`, with `source_pk` derived from chapter UUID and page number.
- Image/cover values use the reserved `example.invalid` domain.
- All three records were retrieved from their target tables after insertion. This validates basic write/read formatting and source UUID string preservation only; it does not validate business authorization, native referential integrity, transactions, or a production migration.

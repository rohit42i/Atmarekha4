# Catalyst development staging status

**Snapshot:** 12 October 2026 (Asia/Kolkata)  
**Purpose:** Prepare an isolated Catalyst staging target for a later, separately authorized migration.  
**Migration status:** PARTIAL DEVELOPMENT DATA IMPORT COMPLETE; NOT READY for full migration or cutover.

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
- The Catalyst `App User` table permission list was set to empty on all 61 tables. A fresh read of all 61 table permission records confirmed this permission model with no mismatches.
- This deliberately blocks the default end-user table access until a trusted authorization/function layer is implemented and tested.

## Partial source-data import (12 October 2026)

A limited, explicitly non-production import has now been run into Catalyst Development. Imported records were checked by source IDs or mapped primary keys using target read-back. Re-running the importer should skip records already present.

- Content metadata: `manga_series` (1), `chapters` (2), `chapter_pages` (22), `pal_do_pal_ke_lamhe_chapters` (1), `pal_do_pal_ke_lamhe_chapter_pages` (2), and `announcements` (1).
- Configuration: `subscription_plans` (3) and `feature_unlock_config` (1).
- Reader/account-adjacent tables: `profiles`, `reading_history` (22), `comments` (14), `chapter_ratings` (17), `comment_likes` (16), `bookmarks` (10), `admins` (5), `feature_login_users` (16), `chapter_views` (211), `community_posts` (2), `community_post_reactions` (8), and the chapter-engagement aggregate tables. `comment_reports` had zero source rows.
- For these imports, target rows were checked after writes. Existing rows were not blindly duplicated. Some admin/feature-login/bookmark and view/community rows were already present in the target and were verified rather than reinserted.
- A partial JSON metadata/configuration snapshot is stored at [CONTENT-DATA-EXPORT.json](./source-snapshot/CONTENT-DATA-EXPORT.json) on the migration branch. It is **not** a full backup: it excludes the complete database, auth identities/credentials, all private/user/payment records, all storage object bytes, and full database routines/policies/indexes. Do not treat it as sufficient for restore.
- Date/time values in imported rows may have been normalized to second precision; JSON/array/numeric fields were mapped to text where the schema manifest specifies it. Foreign keys, triggers, RLS, transaction behavior and business logic are not reproduced by Catalyst Data Store.

## Not completed / explicit blockers

1. **Authentication remains disabled**: hosted, embedded and third-party auth are all off; public signup is off.
2. **API Gateway remains disabled**. No routes were created.
3. **Zero serverless functions exist in the Catalyst project.** A dependency-free Basic I/O liveness function source scaffold is committed under `catalyst-staging/`, but it is not deployed. The connected Catalyst MCP does not expose live function-resource creation/upload/deployment. Import/create it only in Development through the console/CLI and verify before use.
4. **Storage buckets are not created.** Stratus operations returned a first-use-session requirement. The owner must open Stratus/Storage in the Catalyst console once, after which buckets with the intended public/protected split and encryption can be created.
5. No CORS origins, email domains, payment configuration, webhooks, schedules, realtime transport or background jobs were created.
6. Catalyst Data Store is not PostgreSQL. Defaults, multi-column unique keys, composite primary keys, foreign-key enforcement, CHECK constraints, indexes, transactions, triggers, RLS policies and PL/pgSQL functions have not been automatically reproduced. The manifest documents conversions; application-layer constraints and test suites are still required.
7. Array/JSONB/numeric conversions require special handling: JSON values are serialized as text with size validation; exact numeric values must remain decimal strings to avoid floating-point changes.
8. Realtime chat/presence, identity continuity/MFA, Cloudflare R2/Workers, membership entitlements, Razorpay webhook/idempotency behavior and privacy-deletion workflows remain unimplemented and require their own compatibility/acceptance tests.
9. The live source migration ledger and tracked SQL migrations still require semantic reconciliation; seven deployed Supabase Edge Function sources are not tracked on `main`.

## Safety ledger

- Source reads were performed against Supabase project `pbukwjokgkqacaphlqzm`. A limited subset of content metadata and reader-facing rows was copied into the isolated Catalyst Development project as recorded above. This is not a full migration and must not be treated as production-ready.
- The three synthetic, unpublished smoke-test rows remain in the target alongside the imported records. They use `example.invalid` URLs and are not source production records.
- No changes were made to production Supabase, Cloudflare, Razorpay, the live website, or the main runtime code.
- Catalyst Development table containers and table permissions were created/updated only in project `81164000000013050`.
- No API routes, authentication providers, live functions, storage buckets or deployments were enabled. The liveness function currently exists only as source in GitHub.
- Basic synthetic insert/read-back and limited imported-row key verification passed. No full contract/security test suite, application build, full restore test, or rollback rehearsal has been run.

## Readiness decision

The project is **schema-staged, not migration-ready**. Do not provide real production data or change client routing yet. Continue only after Stratus first-use initialization, a function deployment workflow is available, the full compatibility layer is implemented, contracts and security tests pass, backup/restore and rollback are rehearsed, and a separate migration/cutover command is explicitly provided.


## Synthetic smoke-test fixtures

The only rows currently present are deliberately synthetic and unpublished:

- Series slug: `migration-smoke-test-20261012`; UUID `9b2f2d4a-4b8b-4c9a-9d91-000000000114`.
- Draft chapter UUID: `9b2f2d4a-4b8b-4c9a-9d91-000000000115`, linked using the preserved UUID string.
- Page UUID: `9b2f2d4a-4b8b-4c9a-9d91-000000000116`, with `source_pk` derived from chapter UUID and page number.
- Image/cover values use the reserved `example.invalid` domain.
- All three records were retrieved from their target tables after insertion. This validates basic write/read formatting and source UUID string preservation only; it does not validate business authorization, native referential integrity, transactions, or a production migration.

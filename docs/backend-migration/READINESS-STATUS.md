# Backend migration readiness status

**Snapshot:** 12 October 2026 (Asia/Kolkata)  

**Live re-check:** 16 October 2026 (Asia/Kolkata). GitHub PR #60 remains open and draft, head `236a78a8709cb930a50b1522bf0474b14446fa77`; no merge or production cutover was performed. Catalyst Development read-only checks confirm the 61 mapped table containers remain present, but the project still has zero functions and zero Storage buckets; hosted, embedded and third-party authentication remain disabled, public signup is off, and API Gateway remains disabled. The Storage API rejected bucket creation because the owner must initialize Stratus in an authenticated Catalyst console session first. This checkpoint made no production/source writes and did not create a backup, transfer more data, or deploy code.
**Decision:** Schema scaffolding in Catalyst Development is complete and verified at the column-presence level. The system is **not ready for real data migration or production cutover**.

## Verified source snapshot

- Supabase project `Atmarekha`: `ACTIVE_HEALTHY`, region `ap-south-1`, PostgreSQL 17.
- Source metadata lists 59 public tables and 2 private tables (61 total, 411 columns). Metadata lists no row payloads were fetched for this work.
- 145 policies exist under `public`, 13 Storage object policies, 55 public/private SQL functions (36 marked SECURITY DEFINER), 39 public triggers and 7 Storage triggers.
- Six Supabase Storage buckets exist: public `assets`, `chapter-pages`, `community`, `covers`; private `member-content`, `pdlpl-content`.
- Realtime publication includes `group_chat_likes`, `group_chat_messages`, `group_chat_reactions`, `group_chat_reads`, and `pdlpl_comments`.
- **Source security follow-up:** `private.feedback_rate_limits` and `private.dpdp_breach_incidents` have RLS reported disabled by the Supabase metadata/advisory tool. Effective schema grants and Data API exposure were not verified. Review and determine intended grants/policies before any migration; this work made no source changes.
- Sixteen deployed Supabase Edge Functions were listed; nine have source folders tracked on `main`. Seven deployed-only names: `delete-account` v17 (gateway JWT on), `send-chapter-notification` v17 (on), `send-chapter-notification-v2` v25 (on), `send-email-to-users` v7 (on), `get-admin-console-data` v2 (on), `dpdp-data-rights` v4 (on), and `submit-feedback` v1 (off). A disabled gateway JWT flag is not proof of a vulnerability; handler-level auth/signature verification still requires review.

## Verified Catalyst development target

- Organization: `rohitbaswaraj`, Zoho India data center, org ID `60091620701`.
- Dedicated project `Atmarekha`; project ID `81164000000013050`; active `Development` environment.
- Domain: https://atmarekha-60091620701.development.catalystserverless.in
- Existing projects `Polls` and `Project-Rainfall` were not modified.
- 61 Data Store table containers and 411 source-mapped fields were created. The column listing was compared with all 61 source table metadata definitions; expected fields were present after documented name mappings. Two extra unique `source_pk` fields were added for idempotent composite-key upserts in `chapter_pages` and `group_chat_likes`.
- Table permissions were set on all 61 tables: App Administrator gets SELECT/INSERT/UPDATE/DELETE; App User gets no table operations. A follow-up read of all 61 table permission records verified settings with no mismatches.
- See [Catalyst staging status](./CATALYST-STAGING-STATUS.md) and the [schema map manifest](./CATALYST-SCHEMA-MAP.csv) for target table IDs, field mappings and conversions.

## Remaining blockers before any data migration

1. Resolve the first-use Stratus session requirement in the Catalyst console, then provision the planned four public-source and two protected-source **development-only** buckets, all with encryption. See `STRATUS-SETUP.md`. No buckets have been created yet.
2. Approve a target identity/session/MFA design. Catalyst hosted/embedded/third-party auth are currently disabled and public signup is off. Do not enable auth until its configuration and recovery flow are reviewed.
3. Implement and deploy the server-side function layer. Target currently has zero functions. The available MCP connector does not expose function source creation/upload/deployment.
4. Do not enable API Gateway or CORS until function routes, authentication and throttling have been reviewed. API Gateway is currently disabled and there are zero CORS domains.
5. Reconcile 180 live source migration-ledger records against 65 tracked SQL migrations. Name-only comparison produced 51 name matches, 129 live entries without same-named tracked files and 14 tracked names without same-named ledger records; this is not a semantic diff and does not establish which SQL is missing.
6. Recover/review all seven deployed-only function sources/contracts. Confirm current edge versions, privileged SQL/RPCs, table grants, RLS, Auth/MFA/session, storage, event, realtime and payment contracts.
7. Implement all source defaults, check constraints, multi-column unique rules, foreign-key/ownership rules, transaction/atomicity behavior, delete policies, aggregate maintenance, rate limits, audit logs and error contracts in reviewed server-side code/tests.
8. Preserve and verify identities, membership entitlements, privacy deletion propagation, Razorpay signature/idempotency behavior and Cloudflare R2/Worker access independently.
9. Run synthetic-only contract/security/concurrency/idempotency tests, schema reconciliation, backup restore, migration rehearsal and rollback rehearsal. No such test or rehearsal has yet been run.
10. Obtain a separate explicit production migration/cutover authorization. This task does not grant it.

## Compatibility caveats

Catalyst Data Store is not PostgreSQL. UUIDs are represented as `varchar(36)` for source ID preservation; `numeric` is mapped to text to avoid binary floating point; arrays/JSONB are represented as serialized text; timestamp defaults are not automatically preserved as database defaults. Foreign keys and PostgreSQL CHECK constraints are not reproduced simply by matching columns. The composite key manifest fields require deterministic `source_pk` derivation. These behaviors must be implemented and tested before real records are migrated.

## Safety ledger

- Source Supabase inspection in this checkpoint was read-only. A live count-only audit verified 537 rows across 61 mapped source tables. Catalyst Development already contains 448 source rows plus three synthetic fixtures; no new row transfer was performed in this checkpoint. No Supabase Auth identities/credentials or Storage object bytes were copied. The existing partial target includes 12 `payment_events` rows and other reader/account-adjacent data; keep its datastore closed and complete a sensitive-data review before enabling APIs or deploying data-serving functions.
- Catalyst changes were limited to the dedicated Development project `81164000000013050`: Data Store table/column creation and permissions.
- Three synthetic-only, unpublished smoke-test rows were previously inserted and read back: one test series, one draft chapter and one page. Live row-count reconciliation now shows 451 rows across 62 Catalyst tables: 448 source rows plus three synthetic fixtures. 52 source tables match current row counts exactly; three content tables each contain one additional synthetic row; six source tables with rows are not imported. The previous report documents full mapped-field comparisons for 35 tables plus one empty table; those field-level comparisons were not repeated in this checkpoint.
- No changes to production Supabase, Cloudflare, Razorpay, the live website, or main runtime code.
- No Auth, API Gateway, CORS, live serverless functions, buckets, payment settings or deployment were created/enabled. A Basic I/O health-probe source scaffold exists in `catalyst-staging/` in the GitHub branch only; it is not deployed.
- A basic synthetic insert/read-back smoke test passed for series, chapter and page tables. No full domain test suite, backend build, backup restore, migration rehearsal or rollback rehearsal has been run.
- GitHub documentation remains on the dedicated branch and draft PR #60; it has not been merged.

See [AUDIT.md](./AUDIT.md), [DATA-INVENTORY.md](./DATA-INVENTORY.md), [CAPABILITY-MAP.md](./CAPABILITY-MAP.md), [MIGRATION-PLAN.md](./MIGRATION-PLAN.md), [TEST-PLAN.md](./TEST-PLAN.md), [OPERATIONS.md](./OPERATIONS.md), and [CATALYST-STAGING-STATUS.md](./CATALYST-STAGING-STATUS.md). This is schema preparation, not migration authorization.

## Execution support update — 16 October 2026

A phone-only owner runbook is available at [OWNER-EXECUTION-STEPS.md](./OWNER-EXECUTION-STEPS.md). It gives the exact Termux download/backup/verification steps and the controlled sequence for Stratus initialization, Development-only function deployment, later Razorpay test-webhook and Cloudflare/R2 validation, and production cutover gates.

The backup kit now fails closed if the database endpoint does not match the source project or if the reviewed six-bucket inventory/public-private settings differ. It uses owner-only file permissions and strips backup secrets from subprocess environments by default. GitHub Actions validation run #48 passed static syntax/metadata checks. The associated PR build run #3086 also passed dependency audit, regression checks, and production bundle build; Cloudflare deployment/infrastructure steps were skipped. These runs do **not** mean the real backup or a restore test ran.

## Backup status — 12 October 2026

- Source organization plan verified as **Free**. Supabase's official docs say Free projects should regularly export data and maintain off-site backups; daily automated backups are described for Pro/Team/Enterprise. Database backups exclude actual Storage object bytes ([official backup docs](https://supabase.com/docs/guides/platform/backups)).
- Metadata-only source backup artifacts have been committed under [source-snapshot](./source-snapshot/): complete 180-entry migration history, 61-table/411-column metadata, project/extensions/function inventory. These do not contain data rows or object bytes and are not a restorable backup.
- An encrypted local Termux backup kit is committed under [migration-kit/backup](../../migration-kit/backup/README.md); GitHub Actions syntax validation passed. It must be run locally using the database connection URL, a Storage service-role key and an offline passphrase. Those credentials are not stored in GitHub or this conversation.
- **Actual encrypted database + Storage-object backup: NOT YET CREATED.** Supabase live Storage has 6 buckets and 22 objects; zero Storage object bytes have been copied to Catalyst. The 448-row partial Data Store import already exists, so keep it closed and do not transfer additional data until the encrypted backup is produced, integrity-checked, and restored in an isolated environment.

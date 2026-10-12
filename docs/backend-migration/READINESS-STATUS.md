# Backend migration readiness status

**Snapshot:** 12 October 2026 (Asia/Kolkata)  
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

- Source Supabase access in this task was read-only schema metadata; no production rows, auth records, payment payloads, secrets or Storage objects were copied.
- Catalyst changes were limited to the dedicated Development project `81164000000013050`: Data Store table/column creation and permissions.
- Three synthetic-only, unpublished smoke-test rows were inserted and read back from Catalyst: one test series, one draft chapter and one page. No production data was imported.
- No changes to production Supabase, Cloudflare, Razorpay, the live website, or main runtime code.
- No Auth, API Gateway, CORS, live serverless functions, buckets, payment settings or deployment were created/enabled. A Basic I/O health-probe source scaffold exists in `catalyst-staging/` in the GitHub branch only; it is not deployed.
- A basic synthetic insert/read-back smoke test passed for series, chapter and page tables. No full domain test suite, backend build, backup restore, migration rehearsal or rollback rehearsal has been run.
- GitHub documentation remains on the dedicated branch and draft PR #60; it has not been merged.

See [AUDIT.md](./AUDIT.md), [DATA-INVENTORY.md](./DATA-INVENTORY.md), [CAPABILITY-MAP.md](./CAPABILITY-MAP.md), [MIGRATION-PLAN.md](./MIGRATION-PLAN.md), [TEST-PLAN.md](./TEST-PLAN.md), [OPERATIONS.md](./OPERATIONS.md), and [CATALYST-STAGING-STATUS.md](./CATALYST-STAGING-STATUS.md). This is schema preparation, not migration authorization.

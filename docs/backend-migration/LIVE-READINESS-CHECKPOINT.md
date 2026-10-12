# Live migration readiness checkpoint

**Audit date:** 12 October 2026 (Asia/Kolkata)  
**Scope:** Read-only production Supabase inspection; Development-only Catalyst inventory and permission correction; GitHub migration-branch backup/documentation updates.  
**Decision:** Continue staging only. The migration is not accepted, and production cutover is not authorized.

## Verified complete in this checkpoint

- The existing migration branch and draft PR #60 were continued; no merge or production deploy was performed.
- A Git source checkpoint branch, `backup/backend-migration-checkpoint-2026-10-12`, was created from the original migration-branch commit `c90f4d76baf3c346dda486aa4ee86b9284753494`. This preserves repository source state only; it is not a database backup.
- Supabase catalog counts reconcile to 59 public tables / 396 public columns plus 2 private tables / 15 private columns: **61 mapped tables / 411 columns**. Exact count-only queries across those tables returned **537 rows** (41 nonempty, 20 empty). Policies/functions/triggers and Realtime counts match the previously recorded catalog audit: 145 public policies, 13 Storage-object policies, 40 public SQL functions plus 15 private SQL functions (36 SECURITY DEFINER), 39 public triggers, 7 Storage triggers and 5 Realtime publication tables.
- Catalyst Development currently has **62 tables**: all 61 mapped source tables plus the empty staging-only `migration_timestamp_precision_archive`. Its current target row count is **451**: 448 source rows from the existing partial import plus three known synthetic smoke-test rows.
- Live count-only reconciliation: 52 source tables have the same source/target row count, three content tables each have one additional known synthetic fixture, and six tables with source rows are absent from the target. The absent source rows total **89**: `public.group_chat_messages` (2), `public.edge_rate_limits` (39), `public.admin_activity_log` (42), `public.admin_notification_log` (4), `private.feedback_rate_limits` (1) and `public.login_password_protection` (1). The existing report records full mapped-field checks for 35 tables plus one empty table; those field-level checks were not repeated in this checkpoint. See `DATA-MIGRATION-RECONCILIATION.json` and the added row-count columns in `CATALYST-SCHEMA-MAP.csv`.
- Permissions were re-read for all 62 target tables. `App Administrator` has SELECT/INSERT/UPDATE/DELETE; `App User` has no table operations. One exception found on the extra archive table (App User had SELECT) was corrected in Development and verified by read-back.
- Catalyst Stratus presently has **0 buckets**; Catalyst has **0 deployed serverless functions**; API Gateway is disabled and has **0 routes**. Authentication is not enabled. The health-probe scaffold in `catalyst-staging/` remains source-only.
- Supabase Storage currently has **6 buckets and 22 objects** (recorded object-size metadata totals 36,855,671 bytes). No Supabase Storage object bytes were transferred to Catalyst. This is separate from the previously recorded Cloudflare R2 inventory of 2 buckets / 87 objects; Cloudflare configuration and media remain unchanged.
- All 16 active deployed Supabase Edge Functions were inventoried. Source was recovered for the seven deployed-only handlers and committed to this migration branch: `delete-account` (v17), `send-chapter-notification` (v17), `send-chapter-notification-v2` (v25), `send-email-to-users` (v7), `get-admin-console-data` (v2), `dpdp-data-rights` (v4), and `submit-feedback` (v1). The returned files were checked for several common literal-secret patterns; no flags were raised. These are source backups only, not Catalyst rewrites, and are not on `main`.

## Explicit data-sensitivity hold

The partial Catalyst import already includes 12 `payment_events` rows, 9 `user_subscriptions` rows and 8 `push_subscriptions` rows, among other reader/account-adjacent rows. No row values are recorded in this report or in the new matrix. The target currently has no App User table permissions, no API Gateway and no deployed function routes, but these existing staging rows must not be exposed. Review whether payment/event and push-token data should be purged or further minimized before any API, auth, or data-serving function is enabled. No additional sensitive rows were imported in this checkpoint.

## Backup and recovery status

- **Metadata/source-inventory backup:** committed; includes table/column metadata, the 180-entry migration ledger, 158 RLS/storage policies, all 55 public/private SQL function definitions, 46 trigger definitions, 194 index definitions, 233 constraint definitions, Realtime table metadata, source/target row-count fields in the schema map, and seven recovered deployed Edge Function source folders. These are schema/code artifacts, not application row backups and not a restorable data backup.
- **Git checkpoint:** created as described above. This is repository-only.
- **Encrypted PostgreSQL + Supabase Storage object backup:** **not created**. The local Termux kit remains unrun and requires the database connection URL, a server-side Storage key entered locally, and an encryption passphrase. Do not put credentials into chat or GitHub.
- **Restore rehearsal:** **not run**. No backup should be called complete or restorable until a separate staging restore succeeds.
- Other excluded recovery items still need a secure inventory: Supabase Auth/provider settings and secrets, Vault recovery material, deployed function secrets, Cloudflare R2/Worker configuration and object backup, Razorpay configuration, and deployment environment settings.

## Remaining blockers / not started

- The live Supabase migration ledger has 180 entries versus 65 checked-in SQL migrations. Name-based comparisons are not a semantic diff; reconcile migration history and full schema before any SQL migration automation.
- Catalyst Data Store is not PostgreSQL. RLS, SQL functions/RPCs, triggers, defaults, unique/composite keys, foreign-key behavior, transactions, realtime, authentication/MFA, storage authorization and payment entitlement behavior are not yet behaviorally replaced.
- Full table-by-table source-to-target value comparison, API contract/security/concurrency tests, mobile-browser validation, application build/test run, encrypted backup, restore rehearsal, migration rehearsal and rollback rehearsal have not been completed in this checkpoint.
- No production switch is recommended. Supabase Auth stays in use, Cloudflare remains the hosting/media provider, and Razorpay remains the payment provider until separately tested and approved.

## Required manual console action: initialize Stratus in Development

From Android, open the [Atmarekha Catalyst console](https://console.catalyst.zoho.in/baas/60091620701/index), open the **Atmarekha** project, select **Development**, then open **Stratus / Storage** once and complete any first-use initialization prompt. Do not switch to Production or alter Cloudflare/Razorpay. After this step, the six documented staging buckets can be provisioned and verified using `STRATUS-SETUP.md`; do not transfer objects until access split, MIME/size checks and access tests are ready.

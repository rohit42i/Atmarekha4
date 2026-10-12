# Future migration plan

**No plan step below has been executed. This document is not authorization to migrate production.**

## Gate 0 — scope and source-of-truth approval

Obtain written authorization for a development/test project, read-only source schema metadata and the allowed scope. Confirm owner, target data center, residency rules, cost/limits, target environment, rollback decision maker and approved handling of any production metadata.

Required baseline:
- Pin exact source commit and inventory relevant unmerged PRs.
- Obtain full schema-only DDL/catalog: columns/types/defaults, primary/foreign keys, constraints, unique constraints, indexes, views, functions, triggers, extensions and active RLS policies.
- Confirm migration ledger and drift; current tracked migration history is not a full baseline schema.
- Obtain source/contracts for four invoked but untracked names: get-admin-console-data, send-chapter-notification-v2, dpdp-data-rights and submit-feedback.
- Capture operation contracts, role matrix and current backup/restore evidence.

**Stop** if schema, function contract, authorization, identity constraints, recoverable backup or isolated test environment is missing.

## Gate 1 — target compatibility decision

Compare every entity and operation to Catalyst Data Store/ZCQL, Auth, Functions/API Gateway, Signals and a selected real-time approach. Map types, IDs, FKs, defaults, null semantics, uniqueness, sort/pagination, errors, authorization and consistency. Inventory all PostgreSQL functions/triggers and whether invariants depend on synchronous transactions or locking.

If key requirements are PostgreSQL-specific and cannot be reproduced safely, choose a compatible PostgreSQL backend or a documented hybrid instead of forcing the model into Data Store. Do not import SQL migration files directly into Catalyst.

**Acceptance:** reviewed capability map, target architecture decision, data-center/cost review and explicit approved exceptions.

## Gate 2 — baseline regression contracts

Create tests around current domain operations and error behavior before implementation. Use only synthetic fixtures. Define anonymous, own-user, other-user, free-reader, entitled-member, moderator, admin and owner-role permissions. Record current Realtime comment/chat update and Presence behavior.

**Acceptance:** repeatable tests capture input/output/error contracts, pagination, rate limits, transaction-sensitive flows and access decisions.

## Gate 3 — development implementation

Only after separate authorization, provision a dedicated Catalyst development/test project with separate identity, configuration, secrets and quotas. No production rows, storage objects, user accounts or write routing. Implement one domain behind reviewed server-side functions/service interfaces at a time; enforce ownership/entitlements in trusted code.

**Acceptance:** reproducible test setup, contract/security tests, secret scan and verified least privilege.

## Gate 4 — phased domain sequence

1. Public read-only chapter/content metadata and language variants.
2. Profile and preference data after identity mapping is approved.
3. Reading history and bookmarks.
4. Comments, reports, ratings, likes, summary aggregates and moderation.
5. Community and chat only after the Realtime/Presence alternative is approved.
6. Admin tools, announcements, audit logs and atomic page operations.
7. Membership and entitlements after exact period/expiry rules are verified.
8. Payments, password security, privacy and push workflows only as separately authorized workstreams.

Every phase has its own go/no-go decision. This order is not a compatibility guarantee.

## Gate 5 — migration rehearsal and reconciliation

Use synthetic data or an explicitly authorized sanitized test copy in isolated staging. Any real production export/import requires a separate approval and data-handling plan; this readiness task grants neither.

For each entity, define stable IDs, deterministic field mapping, parent-before-child order, nullable/default/timestamp rules, uniqueness and delete behavior. Do not substitute Catalyst-generated ROWID where app relations require preserving Supabase IDs.

Reconcile row counts by entity/status/language; uniqueness; missing references; canonicalized field checks/checksums where appropriate; critical membership entitlements; and derived aggregates. Document intentionally excluded rows without committing row data. Add idempotency keys/checkpoints and test batch replay after a failure. Catalyst ZCQL SELECT has a documented 300-row-per-query limit; pagination and checkpoint recovery must be tested.

## Gate 6 — identity continuity

Identity migration is independent and high risk. Decide whether users can be retained through a supported identity provider or recreated in Catalyst Authentication. Do not assume Supabase password hashes, PKCE codes, refresh tokens, TOTP factors or MFA assurance can be imported.

Approve a recovery strategy such as supported IdP transition, forced reset/re-verification or staged account recovery. Address verified email, same-email collisions, disabled/locked accounts, MFA re-enrollment, help desk, session invalidation and ownership mapping for comments, subscriptions, bookmarks, payment history and audit records.

**Acceptance:** tested identity mapping/recovery; email equality alone is never treated as proof that two accounts are the same person.

## Gate 7 — separate storage and realtime plans

Storage is out of scope now. Keep Cloudflare R2, keys and URLs unchanged unless a distinct storage workstream is approved. Any later storage move requires testing content types, caching, protected access, signed URLs, upload limits, deletions, URL stability and rollback.

Realtime is not a row-import task. Define subscription authorization/filtering, event order, replay, duplicates, reconnect, presence expiry and behavior during outages. Signals alone must not be used as a substitute for client delivery without evidence.

## Gate 8 — cutover rehearsal

Do not casually dual-write to two backends: there is no single atomic transaction across them. Choose and rehearse either a write-freeze/maintenance window with a final delta, or a change-log/outbox replication process with durable checkpoints, idempotency and reconciliation. Do not use best-effort browser dual writes.

Rehearse routing, token trust, auth, real-time reconnect, rate limits, webhook handling, monitoring, freeze/delta, rollback time and user communication.

## Gate 9 — production cutover (separate authorization)

Requires an approved plan; schema/data backup and successful restore; green contract/security/reconciliation/performance/recovery tests; approved identity and media plans; payment sandbox evidence; secure environment and release plan; named go/no-go approver; and a separately approved deployment/cutover ticket.

Keep Supabase recoverable through a defined rollback window. If target-only writes are accepted, prove replay/reconciliation before declaring rollback safe. Never merge or deploy as part of this documentation-only task.

## Rollback principles

- Route back only when the previous backend remains authoritative and no un-reconciled target writes exist.
- If target writes exist, stop or freeze writes, reconcile using the documented change log/checkpoints, replay idempotently to the chosen authoritative source, verify critical entitlements/counts, and only then restore traffic.
- Keep versioned schema snapshots, checkpoints, logs and encrypted backups under restricted access. Do not delete the old system during the first cutover.

## Current execution status

Only repository metadata/source inspection and documentation preparation have occurred. No Catalyst provisioning, schema change, production data movement, dual-write, migration, cutover, deployment or production database operation was performed.

## Readiness-gate update after live audit — 12 October 2026

**Implementation gate remains blocked.** The read-only live snapshot established the following hard prerequisites:

1. **Reconcile migration history first.** Live Supabase reports 180 migration-history entries; Git `main` has 65 tracked SQL files. A normalized-name comparison found 51 name matches, 129 live entries without same-named tracked source and 14 tracked names without same-named live history entries. This is only a name comparison; review semantic equivalence and agree on the authoritative schema baseline before generating or applying any migration.
2. **Recover the deployed-only function source.** Supabase reports 16 active deployed Edge Functions, while 7 have no same-named tracked folder on `main`. Recover/review those sources under source control, then compare live version/hash/behavior for all handlers. Do not disable or redeploy them as part of preparation.
3. **Complete authorization and platform inventory.** Verify private-schema grants for two tables reporting RLS disabled, review all 36 `SECURITY DEFINER` SQL routines and grants, and record current Auth provider/MFA/session/redirect configuration. Map storage buckets, five Realtime publication tables, Cloudflare Workers/R2 and Razorpay behavior separately.
4. **Set up an isolated target only after preflight.** A dedicated Atma Rekha Catalyst Development project has not been identified or created. Confirm India data residency, project type, cost/quota, account ownership and secrets handling before creating it in the Catalyst console; use synthetic data only.
5. **Prove before cutover.** Contract tests, authorization regression, row-count/hash reconciliation, payment/webhook idempotency, backup restore, realtime/storage parity, load testing and rollback rehearsal remain unrun. Production cutover requires separate explicit approval.

No runtime, database, authentication, storage, payment or deployment operation occurred during this audit. The readiness dashboard is documented in `READINESS-STATUS.md`.

## Live progress checkpoint — 12 October 2026

A dedicated Catalyst Development project has since been created by the owner and verified: `Atmarekha`, project ID `81164000000013050`, domain `https://atmarekha-60091620701.development.catalystserverless.in`. The schema scaffold is provisioned: 61 Data Store table containers and 411 mapped source fields, verified by listing columns against source metadata. See [CATALYST-STAGING-STATUS.md](./CATALYST-STAGING-STATUS.md) and [CATALYST-SCHEMA-MAP.csv](./CATALYST-SCHEMA-MAP.csv).

All 61 table permission lists are closed to the default `App User` role (no table operations), while `App Administrator` retains CRUD. Auth, API Gateway, CORS, functions and Stratus buckets remain unconfigured. Bucket creation is blocked until the owner opens Stratus/Storage in the Catalyst console to satisfy a first-use session requirement. The MCP connector does not expose function source creation/deployment.

This fulfills **schema staging only**, not Gate 3 implementation acceptance. No production data rows have been copied or written. Three clearly labeled synthetic-only smoke-test rows were inserted and read back; see `CATALYST-STAGING-STATUS.md`. The next gate is: initialize Stratus, create staging buckets with the documented public/protected split and encryption, select identity/session/MFA design, implement server-side Functions and access controls, run synthetic-only contract/security tests, and verify backup restore/rollback. Do not treat the manifest as an import script or run a production migration based on it.

## Execution order for the real data migration (not yet started)

1. **Backup gate:** run the encrypted Termux database + Storage backup, check SHA-256 and HMAC, then restore it into an isolated PostgreSQL target and verify row counts. Because the source organization is on the Free plan, don't assume a daily provider backup exists. The runbook is [BACKUP-PROGRESS.md](./BACKUP-PROGRESS.md).
2. **Infrastructure gate:** initialize Catalyst Stratus in the project console; create the staging bucket split defined in [STRATUS-SETUP.md](./STRATUS-SETUP.md). Create/import the Development health function via the supported console/CLI. Keep Auth and API Gateway disabled until server-side authorization is implemented.
3. **Content pilot:** after the backup gate, migrate synthetic fixtures first and then public content entities in dependency order: manga series → chapters (Atma and PDPKL) → pages → public announcements/media metadata. Validate UUID continuity, page ordering, language, publication state and all thumbnails. The current three synthetic fixtures must be removed or explicitly excluded before final reconciliation.
4. **Identity and reader data:** only after identity/session/MFA design is approved, map source user UUIDs to target identities and migrate profiles, bookmarks, reading history, comments, ratings, reactions, likes, reports and chat data. Preserve ownership and moderation state. Do not let the default App User role directly access these tables.
5. **Membership and payments:** use test/synthetic provider records first. Migrate only verified subscription state after entitlement parity is proved. Do not move active payment secrets, replay production webhooks, create charges, cancel subscriptions or enable provider callbacks as part of staging tests.
6. **Storage:** copy objects only after bucket access policy, signed URL behavior, MIME/cache metadata, unpublished-page protection and member-content authorization are tested. Reconcile every bucket/object manifest and file checksum.
7. **Privacy/admin/audit:** migrate consent, data-rights requests, nominations, incident and audit rows under reviewed least-privilege boundaries. Preserve retention and deletion dependencies.
8. **Reconciliation:** compare source/target row counts and stable per-record checksums, validate uniqueness/FK/check/default rules implemented in the service layer, and test idempotent retries/partial failure. No success is inferred from a successful insert response alone.
9. **Cutover is a separate decision:** run a no-write or durable-delta rehearsal, a restore and rollback drill, authorization tests, Realtime/chat parity, SEO/public URL checks and payment test-mode checks. Only a separate explicit production-cutover command can authorize switching the live website.

Current state stops at the schema scaffold and synthetic smoke test. The encrypted backup must be produced and restore-tested before step 3 imports any real source rows.

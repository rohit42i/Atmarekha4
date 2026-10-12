# Backend migration readiness status

**Snapshot:** 12 October 2026 (Asia/Kolkata)  
**Decision:** Not ready for an actual migration. This branch prepares documentation only.

## Verified current state

- Supabase project `Atmarekha` is `ACTIVE_HEALTHY`, region `ap-south-1`, PostgreSQL 17.
- Live schema metadata reports 59 public tables with RLS enabled, 2 private tables, and 8 Storage schema tables. There are 145 policies under public, 13 Storage object policies, 55 SQL functions across public/private (36 marked SECURITY DEFINER), 39 public triggers, and 7 Storage triggers.
- Live Storage lists six buckets: four public (`assets`, `chapter-pages`, `community`, `covers`) and two private (`member-content`, `pdlpl-content`).
- Realtime publication includes `group_chat_likes`, `group_chat_messages`, `group_chat_reactions`, `group_chat_reads`, and `pdlpl_comments`.
- Two private-schema tables report RLS disabled: `private.feedback_rate_limits` and `private.dpdp_breach_incidents`. Their effective schema privileges/exposure were not verified, so review before classifying their risk.
- Sixteen active Edge Functions are deployed; nine have tracked source folders on main. Seven are deployed-only: `delete-account` v17 (gateway JWT on), `send-chapter-notification` v17 (on), `send-chapter-notification-v2` v25 (on), `send-email-to-users` v7 (on), `get-admin-console-data` v2 (on), `dpdp-data-rights` v4 (on), and `submit-feedback` v1 (off). Their source was retrieved read-only. An off gateway JWT flag requires handler-level signature/auth review; it is not proof of a vulnerability.
- Catalyst account discovery is in the India data center. No project clearly dedicated to Atma Rekha was identified; no Catalyst resources were created.

## Critical blocker: migration history

The live Supabase migration ledger has 180 records; main tracks 65 SQL migration files. A normalized-name comparison finds 51 names matching, 129 live entries without a same-named tracked file, and 14 tracked file names without a same-named live history entry. This name-only comparison needs manual semantic reconciliation; do not generate, apply, or deploy any migration until a reviewed baseline exists.

## Required before implementation

1. Reconcile the full live migration ledger with tracked migrations and a complete schema baseline.
2. Recover and review the seven deployed-only function sources; compare all deployed versions with tracked code.
3. Finish table/schema grants, RLS, privileged SQL function, Auth/MFA/session, Storage and Realtime inventory.
4. Create a dedicated Catalyst Development project in the correct region after checking quota/cost. Use synthetic data only; do not repurpose an unrelated project.
5. Complete transaction/uniqueness, authorization, identity continuity, data-rights, payment/webhook and storage designs.
6. Run regression/security/consistency tests, validate backups through restore, rehearse migration and rollback, and only then seek separate production-cutover approval.

## Safety record

All Supabase and Catalyst checks in this session were read-only. No production data payloads or secret values were retrieved. No runtime code, database schema, Auth, Edge Function, Storage, payment, Cloudflare, or production configuration was changed. No local build, automated tests, backup/restore rehearsal, or migration rehearsal was run. See [AUDIT.md](./AUDIT.md), [DATA-INVENTORY.md](./DATA-INVENTORY.md), [CAPABILITY-MAP.md](./CAPABILITY-MAP.md), [MIGRATION-PLAN.md](./MIGRATION-PLAN.md), [TEST-PLAN.md](./TEST-PLAN.md), and [OPERATIONS.md](./OPERATIONS.md). These are preparation documents, not migration authorization.

# Atma Rekha backend migration readiness audit

**Audit date:** 12 October 2026  
**Reviewed ref:** main at b4907f74d52d5e57f5622085606c4f3ea51120e6  
**Scope:** Read-only repository audit for a possible future Supabase-to-Zoho Catalyst replacement. Supabase remains active.

## Executive findings

1. The current main branch is a Vite 6 / React 18 root-level application. The browser and UI modules call Supabase directly; no complete provider-neutral data-access boundary exists.
2. The tree contains 65 incremental SQL migration files and nine tracked Supabase Edge Function entry points. The migrations are not a complete baseline schema export: important existing tables are referenced or altered without original create-table definitions in the tracked history.
3. Auth behavior is Supabase-specific: PKCE, persisted/auto-refreshed sessions, URL session detection, a custom password-login protection function, TOTP MFA, role checks and membership entitlement logic.
4. Direct PostgREST queries, SQL RPCs, triggers, RLS and Realtime channels are current contracts. Catalyst Data Store/ZCQL, Functions/API Gateway, Authentication and Signals have different models and are not assumed drop-in replacements.
5. Media and analytics are split between Supabase and Cloudflare. Current media Workers use Supabase-derived auth/configuration. R2, Cloudflare hosting, Razorpay and deployed behavior must remain untouched.
6. Live Supabase re-check confirmed 16 active deployed Edge Functions. Seven deployed functions have no same-named tracked source folder: delete-account, send-chapter-notification, send-chapter-notification-v2, send-email-to-users, get-admin-console-data, dpdp-data-rights and submit-feedback. Their deployed existence was verified and their source was retrieved read-only; see LIVE-READINESS-CHECKPOINT.md.
7. A source abstraction is unsafe to introduce as a preparation-only change: it would touch many call sites and risk changing authorization, error shapes, transactions and behavior. This change therefore remains documentation-only.

## Method and limits

Inspected the returned GitHub main tree and relevant source/configuration, plus read-only live Supabase metadata for tables/columns, migration ledger, RLS policy counts, SQL function-security counts, trigger counts, Realtime publication tables, Storage buckets and deployed Edge Functions. The GitHub tree had 328 paths and was not truncated. Read-only Catalyst checks enumerated the authenticated India-region organization, accessible project names and available capability groups; no Catalyst table, row, user, function, route, CORS entry, auth setting, environment variable or deployment was inspected or changed.

Not fully inspected: complete schema DDL and every constraint/index/view/grant; all SQL function bodies and per-function grants; private-schema access privileges; current Supabase Auth provider/redirect/email/session/MFA settings; Cloudflare bindings/routes and secret values; local uncommitted working tree; live browser behavior; or production row payloads. Table metadata returned table-level counts, but no user-level records or secret values were queried/exported. GitHub branch-protection lookup was denied by the connected integration. This report does not assert live configuration matches Git.

## Baseline repository

- Default branch: main. Reviewed commit: b4907f74d52d5e57f5622085606c4f3ea51120e6.
- Current stack from package.json: React 18, Vite 6, @supabase/supabase-js, Axios and GSAP. Current scripts include dev, build, preview, prebuild and check; no dedicated test script is defined.
- The current source layout is primarily root-level: App.jsx, main.jsx, supabase.js, chapters.js, engagement.js, pdlplEngagement.js, palDoPalKeLamhe.js, plus UI/admin components.
- Existing docs/ contains DPDP_COMPLIANCE.md. docs/backend-migration/ did not exist on the reviewed main tree.
- Open PR #59 adds a Zoho MCP URL in .vscode/mcp.json; open PR #58 proposes a broad refactor and new src/ modules. Neither is merged. This work branches from main and depends on neither.
- The main build workflow performs checks and build on PRs targeting main, while deployment/infrastructure actions have push-to-main conditions. No workflow or deployment configuration is changed here.

## Verified current implementation

### Supabase client and data access

supabase.js imports createClient from @supabase/supabase-js. It reads VITE_SUPABASE_URL and prefers VITE_SUPABASE_PUBLISHABLE_KEY, with VITE_SUPABASE_ANON_KEY as a legacy fallback. It configures PKCE, persisted sessions, auto refresh, URL session detection and a 15-second request timeout. The module warns on missing environment configuration and constructs a client using a placeholder URL/key fallback. This task makes no change to that existing behavior.

Direct table operations appear across App.jsx, chapters.js, engagement.js, pdlplEngagement.js, palDoPalKeLamhe.js, profile/community/reader components and multiple admin components. Operations use PostgREST-style table queries, RPCs, Edge Function invocations, Auth APIs and Realtime channels. Behavior relies jointly on client logic, Auth, RLS, SQL functions/triggers and server-side endpoints.

### Authentication and authorization

Verified tracked behavior includes:
- Sign-up, password reset email, URL code/session exchange, sign-out, account updates, session retrieval and Auth-state listeners in UserAuth.jsx and related components.
- Custom password sign-in through secure-password-login and explicit setting of the resulting session.
- TOTP MFA factor list/enroll/challenge/verify/unenroll and assurance-level checks in MfaGate.jsx and SecuritySettings.jsx.
- Admin role checks through adminAuth.js and related components.
- Membership and chapter entitlement checks in supabase.js, App.jsx, ChapterAccessGuard.jsx and membership-related components.

The secure-password-login Edge Function calls prepare_password_login, record_password_login_failure and reset_password_login_protection, and may invoke the native Supabase user-ban behavior and a Resend security notification. Search did not find signInWithOAuth or signInWithOtp in tracked code. This does not prove no relevant provider settings exist in remote configuration.

### Feature families and key source paths

- Content/reader: App.jsx, chapters.js, ChapterAccessGuard.jsx, ChapterCompletionPrompt.jsx, ChapterFavorites.jsx, ReadingHistoryTracker.jsx.
- Identity/profile/membership: supabase.js, UserAuth.jsx, MfaGate.jsx, SecuritySettings.jsx, adminAuth.js, ProfileV2.jsx, PublicProfile.jsx, Membership.jsx.
- Main engagement: engagement.js, EnhancedComments.jsx, rating-upgrade.js.
- PDPKL chapter and engagement: palDoPalKeLamhe.js, PalDoPalKeLamhe.jsx, PalDoPalAdmin.jsx, pdlplEngagement.js, pdlplR2.js, AdminChapterPages.jsx.
- Community/chat: Community.jsx, CommunityAdmin.jsx, CommunityPage.jsx, GroupChat.jsx.
- Admin/moderation/announcements: AdminPanel.jsx, AdminChapterManager.jsx, AdminChapterPages.jsx, AdminOperations.jsx, AdminManagementTools.jsx, AdminMembership.jsx, AdminModerationQueue.jsx, AdminModerationTools.jsx, AdminProTools.jsx, AdminCommandPalette.jsx, AdminGroupChatTools.jsx, AdminChapterHealth.jsx.
- Privacy/notifications/payments: PrivacyCenter.jsx, notification-fix.js, RazorpayCheckoutButton.jsx, Membership.jsx, plus tracked Edge Functions.

Referenced main data groups include chapters, chapter_pages, manga_series, media, profiles, admins, user_subscriptions, payments, payment_events, bookmarks, reading_history, chapter likes/ratings/shares/views, comments/comment likes/reports, community posts/reactions/members, group chat messages/likes/reactions/reads, announcements, admin logs, moderation records, privacy consent/deletion requests, push subscriptions, rate-limit/login-protection state, and the PDPKL chapter/page/engagement family. See DATA-INVENTORY.md for details and qualifications.

### RPCs, SQL logic and access control

Tracked sources reference RPCs including replace_chapter_pages, record_feature_login, consume_rate_limit, lock_user_subscription_creation, prepare_password_login, record_password_login_failure, reset_password_login_protection, get_admin_user_stats, get_admin_analytics, get_admin_membership_analytics, get_public_chapter_stats, get_public_comment_like_summary, pdlpl_append_chapter_pages, pdlpl_delete_chapter_page, pdlpl_reorder_chapter_page, pdlpl_replace_chapter_page, pdlpl_replace_chapter_pages and pdlpl_upsert_chapter.

Migrations show RLS-policy changes, unique/index additions, rate-limit triggers, timestamp triggers, public-badge/member synchronization, summary/count maintenance and publication/page-access hardening. Some functions and core table definitions predate tracked migrations. Effective live policies and full constraint definitions were not retrieved. No CREATE VIEW statement was identified in scanned migration files; this does not prove live views are absent.

### Realtime

EnhancedComments.jsx subscribes to postgres_changes for public.pdlpl_comments filtered by chapter. GroupChat.jsx uses Supabase Realtime database-change events and Presence for online counts and chat state. Catalyst Signals is documented as an event bus for publishers/targets, not as a verified replacement for filtered browser-side Postgres change feeds or Presence.

### Storage, Cloudflare and analytics

supabase.js exports cloudflareR2. It routes chapter-pages, covers and community paths through an existing Cloudflare media Worker and falls back to Supabase Storage for other bucket names. It applies image processing, uses the current Supabase access token for protected requests and refreshes once after a 401. AdminPanel.jsx and AdminChapterPages.jsx use this facade. PDPKL uses pdlplR2.js and its own media Worker.

worker.js hosts static assets and applies security headers/CSP. wrangler.toml defines the existing Worker/assets configuration. atma-media-worker/index.js and pdlpl-media-worker/index.js use Supabase-related configuration for protected media. analytics-worker/worker.js uses Cloudflare analytics/storage bindings; migration history indicates chapter-view analytics were moved to Cloudflare, so this backend is split rather than purely Supabase. No Worker, R2, URL, CSP, environment or deployment changes are included.

### Server functions, environment and payments

Nine tracked Edge Function entry points exist:
- cancel-razorpay-subscription
- create-razorpay-order
- create-razorpay-subscription
- get-admin-user-stats
- razorpay-subscription-webhook
- register-push-subscription
- secure-password-login
- verify-razorpay-payment
- verify-razorpay-subscription

These use Supabase APIs/RPCs and server-side configuration. Razorpay order/subscription lifecycle, signatures/webhooks, cancellation and entitlement state are sensitive business contracts. Push registration and secure password login also have rate-limit/auth dependencies. Actual secret values were not retrieved or written.

The live project has 16 active Edge Functions. Seven deployed-only handlers (delete-account, send-chapter-notification, send-chapter-notification-v2, send-email-to-users, get-admin-console-data, dpdp-data-rights and submit-feedback) have had their source recovered into this migration branch after a basic literal-secret-pattern scan. They are not yet on `main` and are not Catalyst replacements. Review source and behavior before future migration; see `READINESS-STATUS.md` and `LIVE-READINESS-CHECKPOINT.md`.

Environment variable names are in .env.example; only names and purposes are relevant to this task. Vite-prefixed variables are browser-visible and must not hold secrets. The GitHub workflow includes production deployment operations and must not be triggered as a production push during this task.

## Risks and blockers

1. Missing baseline schema DDL and unknown source/target drift.
2. Widespread direct Supabase calls, with no existing complete provider boundary.
3. PostgreSQL RPCs, row-level policies, triggers, atomic writes and transactional/concurrency requirements.
4. Identity continuity, PKCE, user IDs, TOTP MFA, recovery and session-transition constraints.
5. Four invoked functions absent from tracked source.
6. Realtime subscription/Presence parity.
7. Cloudflare media Workers currently trust Supabase-related identity/configuration.
8. Razorpay and membership entitlement consistency.
9. Catalyst Data Store/ZCQL is not PostgreSQL; compatibility needs a table/API-by-table/API decision.
10. Live metadata was read-only inspected, but a complete schema/grant review, restore rehearsal, local build and automated test execution remain unverified.

## Checks actually performed

- Read-only repository tree, source/configuration and migration inventory inspection.
- Searches for direct table calls, RPCs, Auth, invoked functions and Realtime.
- Catalyst MCP feature/tool discovery only.
- No local build or tests run: no checkout/local execution environment is exposed through the available GitHub/Catalyst integration.
- No schema/data operation, production deployment, auth/storage/payment/Cloudflare change or runtime-code edit occurred.

## Decision

Ship migration-readiness documentation only. Do not add a provider variable or abstraction until the complete schema, missing function contracts, authorization model, auth/MFA, realtime and transaction requirements are resolved.

## Live re-check pointer

The earlier repository-only audit is supplemented by [LIVE-READINESS-CHECKPOINT.md](./LIVE-READINESS-CHECKPOINT.md), which records the current Supabase schema/migration/function counts and the Catalyst project discovery. The key correction is that seven deployed functions exist live without tracked source, and the live migration ledger does not reconcile by name with the tracked migration directory. Neither the live backend nor the website runtime was changed.


## Live-state correction

The live snapshot in [READINESS-STATUS.md](./READINESS-STATUS.md) supersedes repository-only statements above wherever the live environment was previously described as unverified. The live migration ledger has 180 entries versus 65 tracked SQL files; reconcile before any migration operation. No production configuration was changed.

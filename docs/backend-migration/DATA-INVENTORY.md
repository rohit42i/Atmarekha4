# Data and schema inventory from repository artifacts and live snapshot and live snapshot

**Sources:** tracked source and SQL migration files on main at b4907f74d52d5e57f5622085606c4f3ea51120e6, plus read-only metadata from the live Supabase project on 12 October 2026.  
**Limit:** the live snapshot is not a full dump and is not a restore point. The metadata endpoint returned table-level counts, but no row payloads, user details, or secret values were queried/exported. The 65 tracked SQL files do not reconstruct the 180-row live migration ledger by name; see the verified snapshot below.

## Table/entity families visible in source

| Domain | Table names referenced in code or migrations | Source / limits |
|---|---|---|
| Content | manga_series, chapters, chapter_pages, media | chapters.js, App.jsx, AdminPanel.jsx, chapter/page admin. Full original create-table DDL is not present for all core tables. |
| Identity/profile/admin | profiles, admins, user_subscriptions, community_members | supabase.js, adminAuth.js, ProfileV2.jsx, PublicProfile.jsx, Membership.jsx. Column definitions need schema metadata. |
| Payment | payments, payment_events, user_subscriptions | Razorpay Edge Functions and membership code. No payment records were accessed. |
| Atma reading/engagement | bookmarks, reading_history, chapter_likes, chapter_ratings, chapter_shares, chapter_views, comments, comment_likes, comment_reports | engagement.js, ProfileV2.jsx, reader components and migrations. A tracked migration indicates chapter-view analytics moved toward Cloudflare; confirm live state before planning migration. |
| Aggregates | chapter_engagement_summary, comment_like_counts | SQL migrations and trigger functions. Derived data requires reconciliation/rebuild rules. |
| Community | community_posts, community_post_reactions, community_members | Community.jsx, CommunityAdmin.jsx, PublicProfile.jsx. |
| Chat | group_chat_messages, group_chat_likes, group_chat_reactions, group_chat_reads | GroupChat.jsx and admin group-chat tooling. Realtime changes and Presence are used. |
| Announcements/admin/moderation | announcements, admin_activity_log, admin_notification_log, moderation_reports, user_moderation | Admin* components and migration SQL. Full retention and permission rules need source review. |
| Privacy/notifications | dpdp_consent_records, dpdp_deletion_requests, push_subscriptions | PrivacyCenter.jsx, notification-fix.js and Edge Functions. Full deletion propagation contract is not tracked for one invoked endpoint. |
| Rate-limit/feature security | edge_rate_limits, feature_login_users, feature_unlock_config, login_password_protection | Security migrations, FeatureUnlocks.jsx and secure-password-login. Do not read these tables' production rows for this audit. |
| PDPKL content | pal_do_pal_ke_lamhe_chapters, pal_do_pal_ke_lamhe_chapter_pages | palDoPalKeLamhe.js, PalDoPalAdmin.jsx, AdminChapterPages.jsx. Language, page ordering, publish rules and thumbnail fields appear in migrations. |
| PDPKL engagement | pdlpl_comments, pdlpl_comment_likes, pdlpl_comment_like_counts, pdlpl_comment_reports, pdlpl_chapter_likes, pdlpl_chapter_ratings, pdlpl_chapter_shares, pdlpl_chapter_views, pdlpl_bookmarks, pdlpl_reading_history, pdlpl_chapter_engagement_summary | pdlplEngagement.js and migration SQL; comment updates are subscribed via Realtime. |

These are names discovered from tracked source. They do not prove every table is present in the live database, is still used or has exactly the expected schema.

## Observed column names and relationships

Source selects/payloads show field groups such as:
- Chapters: id, manga/series reference, language, chapter number, title, description, status, release/created metadata, cover and thumbnail paths.
- Pages: id, chapter id, page number, image URL/path and order/publication metadata.
- Comments: id, user id, chapter id and/or announcement id, author name, content, created/updated timestamps and parent comment id.
- Profiles: id, username, display name, avatar/profile fields and public badge/tier data.
- Membership: user id, plan id, status, period/expiry values.
- Engagement: user/chapter identifiers, rating, progress, timestamps and ownership references.
- Reports/admin audit: status, reviewer, reviewed time, actor ID, action/entity details and metadata.

These are examples of fields used by code, not complete column sets. Exact types, nullability, defaults, generated fields, uniqueness, foreign keys, delete behavior and row policies require schema-only metadata/DDL. Relationships suggested by code filters must not be treated as authoritative database constraints until verified.

## RPCs/functions found in tracked sources

Content/page: replace_chapter_pages, pdlpl_append_chapter_pages, pdlpl_delete_chapter_page, pdlpl_reorder_chapter_page, pdlpl_replace_chapter_page, pdlpl_replace_chapter_pages, pdlpl_upsert_chapter, pdlpl_set_chapter_status, delete_chapter_page, reorder_chapter_page.

Security/limits: consume_rate_limit, lock_user_subscription_creation, prepare_password_login, record_password_login_failure, reset_password_login_protection, record_feature_login, is_admin.

Analytics/summaries: get_admin_user_stats, get_admin_analytics, get_admin_membership_analytics, get_public_chapter_stats, get_public_comment_like_summary.

Migration files also define/alter trigger functions for timestamps, rate limits, summary/count aggregation, cleanup and profile public-badge synchronization. Full signatures/security/search_path/source definitions and active-state verification are required before porting.

## Constraints, indexes, triggers and RLS evidence

Tracked SQL migrations include chapter series/number/language uniqueness/indexing; comment/user/report/admin lookup indexes; triggers for timestamp updates, rate limiting, summary/count maintenance, cleanup and public-badge/subscription synchronization; and RLS policies for published content, entitled readers, own records, admin actions and protected security state.

This list is not exhaustive for the live system. Full baseline DDL is not in Git, and effective policy/grant state was not retrieved. No CREATE VIEW statement was found in scanned migration files; this does not prove views are absent in the live database.

## Tracked functions and unknown invoked endpoints

Nine tracked Supabase Edge Function folders exist: cancel-razorpay-subscription, create-razorpay-order, create-razorpay-subscription, get-admin-user-stats, razorpay-subscription-webhook, register-push-subscription, secure-password-login, verify-razorpay-payment and verify-razorpay-subscription.

UI source also invokes get-admin-console-data, send-chapter-notification-v2, dpdp-data-rights and submit-feedback; no matching tracked function folder was found on main. Remote existence/source, permissions, inputs, outputs and side effects were not verified. Resolve owner and API contracts before future migration.

Only environment-variable names were inspected. No key or value is copied into this inventory.

## Remaining live-state gaps after the snapshot

A further authorized read-only review is still required for:
1. A complete schema DDL export and all constraints, indexes, views, sequences, enums and grants.
2. Per-function SQL definitions/grants and complete effective RLS/schema privileges, particularly the two private-schema tables reporting RLS disabled.
3. Current Auth provider, redirect, email, session, password-security and MFA settings.
4. Full behavior/source drift review for seven deployed Edge Functions without tracked source, plus version/hash comparison for all 16.
5. Cloudflare binding/route metadata and R2 backup/restore detail, without reading secret values.
6. Verified backup/restore, synthetic-data import/export, functional/security regression and cutover/rollback rehearsals.

## Required future inventory procedure

Create a dated metadata snapshot containing column types/nullability/defaults, all constraints/indexes/FKs, SQL functions/triggers/views/extensions, effective RLS/grants, and a code-to-object map. Include the target conversion specification and all exceptions. Do not commit production row exports, personal data, credentials or keys. Do not construct target schema from this partial document.

## Verified live schema snapshot — 12 October 2026

Live project: `Atmarekha` (`pbukwjokgkqacaphlqzm`), `ACTIVE_HEALTHY`, region `ap-south-1`, PostgreSQL 17 (`17.6.1.155`). This was metadata-only discovery; no live schema migration was applied.

### Current public tables

The live public schema reports 59 tables, all with RLS enabled: `chapters, chapter_pages, announcements, media, profiles, bookmarks, reading_history, admins, comments, chapter_ratings, chapter_views, chapter_likes, comment_likes, comment_reports, notification_subscriptions, subscription_plans, user_subscriptions, payment_events, push_subscriptions, subscriptions, payments, community_posts, community_members, community_post_reactions, member_content, member_messages, group_chat_messages, group_chat_reactions, group_chat_reads, group_chat_likes, user_moderation, moderation_reports, edge_rate_limits, feature_unlock_config, feature_login_users, admin_activity_log, admin_notification_log, manga_series, pal_do_pal_ke_lamhe_chapters, pal_do_pal_ke_lamhe_chapter_pages, chapter_engagement_summary, comment_like_counts, chapter_shares, pdlpl_chapter_engagement_summary, pdlpl_comments, pdlpl_comment_likes, pdlpl_comment_like_counts, pdlpl_comment_reports, pdlpl_chapter_ratings, pdlpl_chapter_views, pdlpl_chapter_likes, pdlpl_chapter_shares, pdlpl_bookmarks, pdlpl_reading_history, dpdp_consent_records, dpdp_deletion_requests, site_feedback, dpdp_nominations, login_password_protection`.

### Private and Storage schemas

- Private tables with RLS disabled: `private.feedback_rate_limits`, `private.dpdp_breach_incidents`. The private schema's effective grants and Data API exposure were not verified; keep this as an open audit item, not an automatic vulnerability conclusion.
- The `storage` schema reports 8 tables with RLS enabled. There are 13 policies on `storage.objects`.
- Storage buckets: `assets` (public), `chapter-pages` (public; 20 MiB limit; image MIME family), `community` (public; 15 MiB limit; allow-list configured), `covers` (public), `member-content` (private), `pdlpl-content` (private; 20 MiB limit; image types allow-listed).
- Installed extensions reported by Supabase: `pgcrypto`, `pg_stat_statements`, `supabase_vault`, `uuid-ossp`, `plpgsql`.

### Security-sensitive SQL surface

- 145 policies are reported under `public` across 59 tables, with RLS enabled on each public table.
- 55 SQL functions were counted in `public` and `private`; 36 are marked `SECURITY DEFINER` (21 public, 15 private). The privilege-count query reported 8 public functions executable by `anon`, 18 by `authenticated`, and 1 private function executable by `authenticated`. This is an inventory count, not an assessment that the grants are wrong; each privileged function needs a deliberate authorization review.
- 39 user triggers are reported in `public` and 7 in `storage`. Important behavior includes rate limiting, chapter/comment engagement summary maintenance, moderation, timestamp updates, profile badge/display-name locks and announcement limits.
- The `supabase_realtime` publication contains `group_chat_likes`, `group_chat_messages`, `group_chat_reactions`, `group_chat_reads` and `pdlpl_comments`.

### Live migration ledger versus tracked SQL files

The deployed migration history lists 180 entries from `20260811002807` through `20261008052712`; `main` contains 65 SQL files under `supabase/migrations/`. A normalized-name-only comparison found 51 name matches, 129 live entries with no same-named tracked file, and 14 tracked files with no same-named live entry. Do not treat that raw name comparison as proof of missing or unapplied changes because older migrations may have different timestamps or names. Reconcile every record semantically against the live schema and source history before generating, applying, or deploying migrations.

### Live Edge Functions

Sixteen active Edge Functions are deployed. Seven have no same-named tracked source directory: `delete-account`, `send-chapter-notification`, `send-chapter-notification-v2`, `send-email-to-users`, `get-admin-console-data`, `dpdp-data-rights`, and `submit-feedback`. The deployed code was retrieved read-only for inventory; secret values were not read. See `LIVE-READINESS-CHECKPOINT.md` for versions, JWT-gateway settings, and concise contract notes.


## Verified live schema snapshot — 12 October 2026

Live project: `Atmarekha` (`pbukwjokgkqacaphlqzm`), status `ACTIVE_HEALTHY`, region `ap-south-1`, PostgreSQL 17 (`17.6.1.155`).

**Current `public` tables (59; RLS enabled on all 59):** chapters, chapter_pages, announcements, media, profiles, bookmarks, reading_history, admins, comments, chapter_ratings, chapter_views, chapter_likes, comment_likes, comment_reports, notification_subscriptions, subscription_plans, user_subscriptions, payment_events, push_subscriptions, subscriptions, payments, community_posts, community_members, community_post_reactions, member_content, member_messages, group_chat_messages, group_chat_reactions, group_chat_reads, group_chat_likes, user_moderation, moderation_reports, edge_rate_limits, feature_unlock_config, feature_login_users, admin_activity_log, admin_notification_log, manga_series, pal_do_pal_ke_lamhe_chapters, pal_do_pal_ke_lamhe_chapter_pages, chapter_engagement_summary, comment_like_counts, chapter_shares, pdlpl_chapter_engagement_summary, pdlpl_comments, pdlpl_comment_likes, pdlpl_comment_like_counts, pdlpl_comment_reports, pdlpl_chapter_ratings, pdlpl_chapter_views, pdlpl_chapter_likes, pdlpl_chapter_shares, pdlpl_bookmarks, pdlpl_reading_history, dpdp_consent_records, dpdp_deletion_requests, site_feedback, dpdp_nominations, login_password_protection.

**Private tables:** `private.feedback_rate_limits`, `private.dpdp_breach_incidents`; metadata reports RLS disabled for both. Effective schema grants and API exposure were not verified; do not infer exploitability without those checks.

**Storage:** 8 Storage-schema tables report RLS enabled. The 6 configured buckets are `assets` (public), `chapter-pages` (public, 20 MiB limit, image types), `community` (public, 15 MiB limit, MIME allow-list), `covers` (public), `member-content` (private), and `pdlpl-content` (private, 20 MiB limit, image allow-list). Cloudflare R2/Workers are a separate live media path and were not modified.

**Policies and SQL behavior:** 145 policies reported in `public`; 13 policies on `storage.objects`; 55 functions in `public`/`private`, 36 marked `SECURITY DEFINER`; 39 user triggers in `public` and 7 in `storage`. The `supabase_realtime` publication lists `group_chat_likes`, `group_chat_messages`, `group_chat_reactions`, `group_chat_reads`, and `pdlpl_comments`. Five installed extensions are reported: `pgcrypto`, `pg_stat_statements`, `supabase_vault`, `uuid-ossp`, and `plpgsql`.

**Migration history:** live history contains 180 records from `20260811002807` to `20261008052712`; main has 65 SQL files. A normalized-name comparison found 51 same-name matches, 129 live rows without a same-named tracked file, and 14 tracked names without a same-named live row. Because timestamps/names can differ for semantically equivalent historical changes, review every mismatch manually before any migration operation.

**Deployed functions:** 16 active functions are present. Seven deployed names lack tracked source folders: `delete-account`, `send-chapter-notification`, `send-chapter-notification-v2`, `send-email-to-users`, `get-admin-console-data`, `dpdp-data-rights`, and `submit-feedback`. Deployed code was retrieved read-only for these functions; no secret values were captured. Version and gateway JWT settings are in READINESS-STATUS.md.

## Verified source metadata and Catalyst mapping snapshot — 12 October 2026

The read-only Supabase metadata endpoint returned **61 source tables (59 public, 2 private) and 411 columns**. The source-column type distribution was: 133 text, 118 UUID, 100 timestamptz, 34 integer, 10 boolean, 6 bigint, 3 smallint, 3 arrays, 3 jsonb and 1 numeric. Metadata was used without exporting row payloads.

The dedicated Catalyst Development project `Atmarekha` (project ID `81164000000013050`) now has matching table containers for all 61 source tables and all 411 source fields after the recorded name conversions. Two extra `source_pk` fields were added for the source composite primary keys (`chapter_pages` and `group_chat_likes`). Target table IDs and field conversions are recorded in [CATALYST-SCHEMA-MAP.csv](./CATALYST-SCHEMA-MAP.csv); private tables are flattened to `private_feedback_rate_limits` and `private_dpdp_breach_incidents`.

This is a structural mapping only. No source rows, user/auth records, payment records, or media objects were copied. A target field’s presence does not imply preservation of source defaults, indexes, composite constraints, foreign-key delete behavior, database functions, triggers, RLS, or transactions. IDs must remain the original UUID strings, and the service layer must enforce relationships and invariants.

### Target-only synthetic fixtures

The Catalyst target contains three synthetic, unpublished smoke-test rows inserted and read back on 12 October 2026: a series with slug `migration-smoke-test-20261012`, one draft chapter linked by source UUID string, and one page linked by source chapter UUID plus `source_pk`. Cover/page URLs use `example.invalid`. These rows do not exist in Supabase and must be excluded from any test export/rehearsal data reconciliation. No real source rows were copied.

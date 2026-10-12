# Data and schema inventory from repository artifacts

**Source:** tracked source and SQL migration files on main at b4907f74d52d5e57f5622085606c4f3ea51120e6.  
**Limit:** this is a code-reference inventory, not an authoritative live schema. The 65 SQL files are incremental migrations, not a complete foundational DDL set. No production records, row counts, user details or secrets were queried/exported.

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

## Not inventoried from live state

A separately authorized read-only review must obtain:
1. Live table/column catalog, schema DDL and migration ledger/drift.
2. PK/FK/unique/check constraints, indexes, views, extensions, functions and triggers.
3. Effective RLS policies, grants and auth/storage policies.
4. Auth provider, redirect, email/session/MFA settings and user-identity metadata (no personal row values).
5. Deployed functions and secret *names* only, plus source for missing functions.
6. Cloudflare binding/route metadata where required, never secret values.
7. Data volumes/counts only if approved for capacity planning and designed to avoid personal-data exposure.

## Required future inventory procedure

Create a dated metadata snapshot containing column types/nullability/defaults, all constraints/indexes/FKs, SQL functions/triggers/views/extensions, effective RLS/grants, and a code-to-object map. Include the target conversion specification and all exceptions. Do not commit production row exports, personal data, credentials or keys. Do not construct target schema from this partial document.
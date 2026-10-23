# Atma Rekha full-stack audit checklist
**Audit date:** 2026-10-22  
**Repository:** `rohit42i/Atmarekha4`  
**Supabase project:** `pbukwjokgkqacaphlqzm`  
**Scope:** GitHub source and workflows, Supabase schema/policies/functions/logs, Cloudflare Workers/R2/DNS, Resend domain/templates/events.

> **Historical snapshot:** this checklist captures findings from October 22. For current status, use [`full-stack-audit-checklist-2026-10-23.md`](full-stack-audit-checklist-2026-10-23.md). Entries below have been updated where later verification changed the outcome.

Status meanings: **PASS** = directly verified; **FIXED** = change applied and rechecked; **BLOCKED** = requires an account/dashboard action not available through the connected tools; **OPEN** = needs further testing or a safe decision.

## Priority 0: production failures
- [x] **FIXED AND DEPLOYED: Email audience reconciliation.** `resend-contact-sync` and `resend-contact-backfill` now use Supabase consent and unsubscribe preferences as the source of truth. No `RESEND_CONTACTS_API_KEY` is required and no duplicate provider contact list is maintained.
- [ ] **OPEN: End-to-end UI test for every action and link.** No full browser click-through has been completed. CI now includes fixed-route, security-header, and sitemap validation after deployment, but that is not a browser test. Still test signup/sign-in/reset, profile changes, comments/reactions/reports, More/notifications, chapter reader, membership/payment, admin tabs/actions, Email Studio, data export/deletion, and external links.

## Supabase / database
- [x] **PASS: RLS enabled on all public tables checked.** The direct audit query found no public base tables with RLS disabled.
- [x] **PASS: `record_feature_login()` grant verified.** Execute permission exists for `authenticated`, `postgres`, and `service_role`; it was not granted to `anon`. Keep the user-facing signed-in feature intact.
- [x] **PASS: Restricted tables remain fail-closed.** `email_marketing_preferences` and `notification_event_dispatches` have RLS enabled without client policies. Leave them restricted unless a deliberate authenticated client use case is proven.
- [x] **FIXED AND VERIFIED: Index both `email_campaigns` foreign keys.** Added `email_campaigns_created_by_idx` and `email_campaigns_template_id_idx` using recorded Supabase migration `20261022155809`; both indexes are present in `pg_indexes`, and the performance advisor no longer reports unindexed foreign keys.
- [x] **FIXED AND VERIFIED: Remove three duplicate/overlapping SELECT policies.** Removed duplicate owner-only SELECT policies from `dpdp_consent_records` and `dpdp_nominations`, plus the redundant owner-only policy from `dpdp_deletion_requests`. Rechecked `pg_policies`: the reader-owned condition remains, and the broader owner/admin deletion policy is preserved.
- [x] **FIXED AND VERIFIED: Optimize six RLS auth checks.** Rewrote the policies using scalar `(SELECT auth.uid())` without changing authenticated roles or owner/admin permission intent. The post-change performance advisor no longer reports `auth_rls_initplan` for these policies.
- [x] **PASS: Re-ran Supabase security/performance advisors.** Foreign-key-index and six RLS-initplan findings cleared. **OPEN:** unused-index recommendations remain informational; do not remove indexes without query-plan and traffic review. `record_feature_login()` remains intentionally available to authenticated users for feature unlock tracking; it checks `auth.uid()`, uses a fixed search path and cannot be executed by `anon`.
- [ ] **OPEN: Validate account data export, deletion-request status and email preferences in the app.** Function source includes stable export pagination and request queue changes, but each user-visible flow still needs a signed-in browser test against live data.
- [ ] **OPEN: Review recent function error rates after the audience-source change.** Earlier `resend-contact-sync` 401/502 errors were caused by the retired Resend Contacts API dependency. Recheck recent logs for new failures rather than treating the historical count as current.

## Resend
- [x] **PASS: Sending domain.** `atmarekha.in` is verified and sending is enabled.
- [x] **PASS: Delivery sample.** Metrics for 2026-10-15 through 2026-10-22 report 62 sent/delivered, 0 failed, 0 bounced, 0 complaints, and 6 clicks.
- [x] **PASS: Webhook registered.** Enabled webhook points to `/functions/v1/resend-email-webhook` and subscribes to sent, delivered, delayed, bounced, complained, and failed events.
- [x] **PASS: Suppression list query.** No suppressions were returned by the account query.
- [x] **FIXED: Provider contact access is not required.** Email eligibility is evaluated against Supabase consent and opt-out records at send time.
- [ ] **OPEN: Verify live unsubscribe end-to-end.** Test a dedicated test account, click the unsubscribe action, ensure the database preference updates and future chapter announcements skip that account. A mirrored Resend contact list is not used. Do not test on a real reader without permission.
- [x] **FIXED AND DEPLOYED: Email Studio chapter announcement.** Deployed `resend-email-studio` Edge Function version 18; removed the forced generic subject, updated the active chapter template to `Chapter {{chapter_number}} is now out!`, restored actual line breaks in its plain-text body, used the homepage link only, and retained reader-update preference/unsubscribe enforcement.
- [x] **FIXED AND VERIFIED BY CI: Reusable template values and layout.** Email Studio exposes editable fields for announcement, expiry, payment, maintenance, and support placeholders. The email wrapper uses full-width white background with Roboto/Arial Medium fallback, without the grey card or generic website footer. Static regression tests and the production build passed.
- [ ] **OPEN: Open tracking is disabled.** Resend reports 0 opens, but open-tracking is off, so this is not valid evidence of zero readership. Decide whether opens should be enabled; click tracking is currently on.
- [ ] **OPEN: Review repeated historical test sends.** Recent event history includes many test/preview messages to the same address. Use a test-only address and avoid accidental sends to all recipients during debugging.
- [ ] **OPEN: Inspect each published template and variables.** Five published templates exist. Check preview and test render for missing variables, wrong chapter number/title/URL, styling, mobile layout, text alternative and homepage-only linking before any campaign send.

## Cloudflare / R2 / Workers
- [x] **PASS: Main zone.** `atmarekha.in` zone is active and not paused.
- [x] **PASS: Main Worker custom domains.** Both `atmarekha.in` and `www.atmarekha.in` are enabled on production service `atmarekha4`.
- [x] **PASS: Media CDN binding.** `cdn.atmarekha.in` custom domain is enabled with active SSL and ownership on the `atma-rekha-manga` R2 bucket.
- [x] **PASS: Analytics Worker binding.** `atma-rekha-analytics` is deployed with the `ANALYTICS_BUCKET` binding to `atma-rekha-manga`; cron schedule is `15 * * * *`.
- [x] **PASS: CI endpoint smoke test.** Latest successful main build includes a live analytics endpoint smoke test that requires a numeric view-count response.
- [ ] **OPEN: Verify live view increments from a real published chapter.** Smoke test proves endpoint response format, not that a reader view successfully increments and subsequently appears in the public page and admin dashboard. Check a controlled view event end-to-end.
- [ ] **OPEN: Verify media uploads, fetches, and protected chapters.** R2 bucket has no explicit CORS policy; media Worker declares allowed-origin controls. Confirm real upload/fetch routes work from the website and paid/unpublished chapter content cannot be fetched without authorization before deciding whether CORS needs a policy.
- [ ] **OPEN: Review duplicate legacy Workers.** Cloudflare still lists older `atmarekha`, `atmarekha1`, `atmarekha2`, and `atmarekha3` scripts alongside `atmarekha4`. No deletion is proposed; first inspect routes, traffic and dependencies.
- [x] **FIXED IN SOURCE: Scope the Worker HSTS response.** `worker.js` now emits `Strict-Transport-Security: max-age=15552000` without `includeSubDomains` until CDN/Resend subdomains are verified. The source regression test passes.
- [x] **FIXED AND VERIFIED: Disable the competing zone-level HSTS header.** Cloudflare's dedicated `/settings/security_header` endpoint confirmed `enabled=false` at 2026-10-22 16:18 UTC. A subsequent live deployment check observed the expected `Strict-Transport-Security: max-age=15552000` response from the Worker.
- [ ] **OPEN: Observe Worker errors/latency.** Worker Logpush is disabled on the inspected scripts. Consider enabling appropriate, privacy-aware logs or rely on bounded live smoke tests.
- [x] **FIXED AND VERIFIED: Cloudflare transport settings.** Live settings are `always_use_https=on`, `min_tls_version=1.2`, and `automatic_https_rewrites=on`. Zone-level HSTS is disabled and verified through its individual settings endpoint; the Worker controls the response header.
- [ ] **BLOCKED: Automate zone-setting enforcement in CI.** The existing Worker-deploy token returns HTTP 403/code 9109 on zone settings. CI uses a separate optional `CLOUDFLARE_ZONE_SETTINGS_TOKEN`, warns if absent, and continues to live smoke tests. Add a zone-scoped GitHub Actions secret with Zone Settings Read/Edit permissions to automate this permanently.
- [ ] **OPEN: Check origin routing and DNS health from external network.** DNS records and Cloudflare custom-domain settings are configured, but a complete external browser/HTTP crawl could not be performed during this audit.

## GitHub / CI / code
- [x] **PASS: Current main build.** Main head at audit time: `5ce2917c123e243a941d3c0995e952ec833a5444`. Production build passed: https://github.com/rohit42i/Atmarekha4/actions/runs/39799968497
- [x] **PASS: Current CodeQL run.** https://github.com/rohit42i/Atmarekha4/actions/runs/39799968386
- [x] **PASS: Recent stability PR merged.** PR #127 records prior fixes for privacy exports, email studio loading, notification retries, service-key compatibility, payment/webhook handling, avatar fallback and related flows: https://github.com/rohit42i/Atmarekha4/pull/127
- [ ] **FIX PROPOSED: Review this audit's migration PR.** Do not mark database changes complete until CI passes, PR is merged, migration is applied, and advisors are re-run.
- [x] **FIXED AND VERIFIED: XML entity double-decoding alert.** The sitemap decoder now performs one regex replacement pass. The follow-up CodeQL run succeeded: https://github.com/rohit42i/Atmarekha4/actions/runs/39812945600. The review thread was resolved.
- [ ] **OPEN: Triage old open pull requests.** At audit time, the repository has numerous open PRs, including #123 (email library), #117 (signup email notice), #112 (bilingual informational pages), and dependency updates. Compare each diff against current main and test status before merging; do not bulk-merge.
- [ ] **OPEN: Add click-level regression automation.** Existing `npm run check` and Worker SEO tests are useful, but cannot prove every visible button and destination works in a browser.
- [x] **PASS: Live route/security smoke test.** Production build run https://github.com/rohit42i/Atmarekha4/actions/runs/39813384310 passed after the HSTS assertion was corrected. The test verifies HTTP-to-HTTPS redirect, HSTS/nosniff headers, a fixed public-route allowlist, same-origin shell assets, and HTTPS/same-origin sitemap URLs. **OPEN:** this still does not prove every anchor destination or interactive button works; run a real-browser end-to-end suite for those flows.
- [x] **FIXED: Retired the legacy manual chapter-email workflow.** `.github/workflows/send-chapter-email.yml` and its standalone Gmail SMTP helper are removed from `main`; use the Admin Panel Email Studio, which checks saved eligibility rules.
- [ ] **OPEN: Review full dependency audit.** Production dependency audit is a build gate. The complete development-dependency audit is currently `continue-on-error`; review any warnings before raising strictness.

## Manual actions needed to finish
1. Add GitHub Actions secret `CLOUDFLARE_ZONE_SETTINGS_TOKEN` with Zone Settings Read/Edit, scoped to the `atmarekha.in` zone, so CI can enforce the already-correct transport settings.
2. Run a controlled real-browser test with one test account, covering links and actions listed above.
3. Verify a real published-chapter view increment and confirm the public chapter count and admin dashboard agree.

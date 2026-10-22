# Atma Rekha full-stack audit checklist
**Audit date:** 2026-10-22  
**Repository:** `rohit42i/Atmarekha4`  
**Supabase project:** `pbukwjokgkqacaphlqzm`  
**Scope:** GitHub source and workflows, Supabase schema/policies/functions/logs, Cloudflare Workers/R2/DNS, Resend domain/templates/events.

Status meanings: **PASS** = directly verified; **FIXED** = change applied and rechecked; **BLOCKED** = requires an account/dashboard action not available through the connected tools; **OPEN** = needs further testing or a safe decision.

## Priority 0: production failures
- [ ] **BLOCKED: Fix Resend contact sync authentication.** Supabase logs show 28 `Resend contact lookup failed. 401` messages and 28 HTTP 502 responses from `/functions/v1/resend-contact-sync`. The function expects a separate `RESEND_CONTACTS_API_KEY` with Contacts API permissions. In Supabase Dashboard → Project Settings → Edge Functions → Secrets, add/update `RESEND_CONTACTS_API_KEY` using a Resend key with Contacts permissions. Keep `RESEND_API_KEY` send-only and server-side. Do not put either secret in the browser or database. Then test sync once with a test account and confirm the logs show success.
- [ ] **BLOCKED: Enable leaked-password protection.** Supabase security advisor says Auth leaked-password protection is disabled. Enable it in Authentication → Security and test signup/password change. Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- [ ] **OPEN: End-to-end UI test for every action and link.** No full browser click-through has been completed. CI now includes fixed-route, security-header, and sitemap validation after deployment, but that is not a browser test. Still test signup/sign-in/reset, profile changes, comments/reactions/reports, More/notifications, chapter reader, membership/payment, admin tabs/actions, Email Studio, data export/deletion, and external links.

## Supabase / database
- [x] **PASS: RLS enabled on all public tables checked.** The direct audit query found no public base tables with RLS disabled.
- [x] **PASS: `record_feature_login()` grant verified.** Execute permission exists for `authenticated`, `postgres`, and `service_role`; it was not granted to `anon`. Keep the user-facing signed-in feature intact.
- [x] **PASS: Restricted tables remain fail-closed.** `email_marketing_preferences` and `notification_event_dispatches` have RLS enabled without client policies. Leave them restricted unless a deliberate authenticated client use case is proven.
- [x] **FIXED AND VERIFIED: Index both `email_campaigns` foreign keys.** Added `email_campaigns_created_by_idx` and `email_campaigns_template_id_idx` using recorded Supabase migration `20261022155809`; both indexes are present in `pg_indexes`, and the performance advisor no longer reports unindexed foreign keys.
- [x] **FIXED AND VERIFIED: Remove three duplicate/overlapping SELECT policies.** Removed duplicate owner-only SELECT policies from `dpdp_consent_records` and `dpdp_nominations`, plus the redundant owner-only policy from `dpdp_deletion_requests`. Rechecked `pg_policies`: the reader-owned condition remains, and the broader owner/admin deletion policy is preserved.
- [x] **FIXED AND VERIFIED: Optimize six RLS auth checks.** Rewrote the policies using scalar `(SELECT auth.uid())` without changing authenticated roles or owner/admin permission intent. The post-change performance advisor no longer reports `auth_rls_initplan` for these policies.
- [x] **PASS: Re-ran Supabase security/performance advisors.** Foreign-key-index and six RLS-initplan findings cleared. **OPEN:** 39 unused-index recommendations remain informational; don't remove them without query and traffic review. The security advisor still reports leaked-password protection disabled and intentionally flags `record_feature_login()` because authenticated users call this security-definer RPC to increment their own once-only login counter and read unlock status; its code checks `auth.uid()`, has a fixed search path, and `anon` cannot execute it.
- [ ] **OPEN: Validate account data export, deletion-request status and email preferences in the app.** Function source includes stable export pagination and request queue changes, but each user-visible flow still needs a signed-in browser test against live data.
- [ ] **OPEN: Review function error rates and timing after secret fix.** In the latest queried log window, `resend-email-studio` had 6 requests averaging about 1.74 seconds (max about 3.0 seconds); `resend-contact-sync` had 55 requests averaging about 0.65 seconds, with 28 failures. Recheck after configuration is corrected.

## Resend
- [x] **PASS: Sending domain.** `atmarekha.in` is verified and sending is enabled.
- [x] **PASS: Delivery sample.** Metrics for 2026-10-15 through 2026-10-22 report 62 sent/delivered, 0 failed, 0 bounced, 0 complaints, and 6 clicks.
- [x] **PASS: Webhook registered.** Enabled webhook points to `/functions/v1/resend-email-webhook` and subscribes to sent, delivered, delayed, bounced, complained, and failed events.
- [x] **PASS: Suppression list query.** No suppressions were returned by the account query.
- [ ] **OPEN: Confirm Contacts API permissions.** See Priority 0; normal email sending and contacts access are separate API capabilities.
- [ ] **OPEN: Verify live unsubscribe end-to-end.** Test a dedicated test account, click the unsubscribe action, ensure the database preference updates, future chapter announcements skip that account, and contacts sync reflects the preference. Do not test on a real reader without permission.
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
- [ ] **FIX PROPOSED: Scope the Worker HSTS response.** `worker.js` previously emitted `max-age=31536000; includeSubDomains`; the audit change proposes `max-age=15552000` without `includeSubDomains` until all CDN/Resend subdomains are checked. A source-level regression assertion and post-deploy live-header check are included.
- [ ] **OPEN: Observe Worker errors/latency.** Worker Logpush is disabled on the inspected scripts. Consider enabling appropriate, privacy-aware logs or rely on bounded live smoke tests.
- [ ] **FIX PROPOSED: Cloudflare hardening workflow corrected in the audit PR.** The old request omitted the required `items` wrapper and `continue-on-error` hid the failure. The replacement sends the correct payload, verifies live HTTPS redirect/TLS settings, and fails deployment if they do not match. Live zone values are now `always_use_https=on`, `min_tls_version=1.2`, and automatic HTTPS rewrites on. Zone-level HSTS remains disabled because the Worker owns that response header.
- [ ] **OPEN: Check origin routing and DNS health from external network.** DNS records and Cloudflare custom-domain settings are configured, but a complete external browser/HTTP crawl could not be performed during this audit.

## GitHub / CI / code
- [x] **PASS: Current main build.** Main head at audit time: `5ce2917c123e243a941d3c0995e952ec833a5444`. Production build passed: https://github.com/rohit42i/Atmarekha4/actions/runs/39799968497
- [x] **PASS: Current CodeQL run.** https://github.com/rohit42i/Atmarekha4/actions/runs/39799968386
- [x] **PASS: Recent stability PR merged.** PR #127 records prior fixes for privacy exports, email studio loading, notification retries, service-key compatibility, payment/webhook handling, avatar fallback and related flows: https://github.com/rohit42i/Atmarekha4/pull/127
- [ ] **FIX PROPOSED: Review this audit's migration PR.** Do not mark database changes complete until CI passes, PR is merged, migration is applied, and advisors are re-run.
- [ ] **OPEN: Verify CodeQL scanner after the XML decoder fix.** GitHub Advanced Security flagged chained XML entity replacements as possible double-decoding. `scripts/smoke-test-live-site.mjs` now decodes exactly one XML entity layer in a single regex pass. Confirm the latest main-branch Advanced Security scan clears the alert before marking this complete.
- [ ] **OPEN: Triage old open pull requests.** At audit time, the repository has numerous open PRs, including #123 (email library), #117 (signup email notice), #112 (bilingual informational pages), and dependency updates. Compare each diff against current main and test status before merging; do not bulk-merge.
- [ ] **OPEN: Add click-level regression automation.** Existing `npm run check` and Worker SEO tests are useful, but cannot prove every visible button and destination works in a browser.
- [ ] **OPEN: Verify live site smoke-test deployment result.** The post-deploy test checks HTTP-to-HTTPS redirect, HSTS/nosniff headers, a fixed allowlist of public routes (including Hindi and English chapter listing), same-origin shell asset references, and HTTPS/same-origin sitemap locations. It never fetches destinations supplied by page or sitemap content. A green PR build is not the live test; confirm the production deployment run passed. **OPEN:** this does not prove every anchor destination or interactive button works.
- [ ] **OPEN: Consolidate the legacy manual chapter-email workflow.** `.github/workflows/send-chapter-email.yml` is `workflow_dispatch` only, asks for a manually supplied recipient list, and uses Nodemailer/Gmail SMTP rather than Resend. Verify whether it is still needed; then migrate it to the approved Resend sender/configuration or retire the path so it cannot silently diverge from the production Email Studio. The Resend sender identity and GitHub secret availability must be confirmed before changing it.
- [ ] **OPEN: Review full dependency audit.** Production dependency audit is a build gate. The complete development-dependency audit is currently `continue-on-error`; review any warnings before raising strictness.

## Manual actions needed to finish
1. Add a dedicated Resend Contacts API key as `RESEND_CONTACTS_API_KEY` in Supabase Edge Function secrets; keep the send key separate. Secret changes are not exposed to the connected management API.
2. Enable Supabase leaked-password protection in Auth security settings.
3. Run a controlled real-browser test of the app with one test account, covering links and actions listed above.
4. After the audit PR merges and its migration runs, rerun Supabase advisors and the live view-count test.

# Atma Rekha full-stack audit checklist
**Audit date:** 2026-10-22  
**Repository:** `rohit42i/Atmarekha4`  
**Supabase project:** `pbukwjokgkqacaphlqzm`  
**Scope:** GitHub source and workflows, Supabase schema/policies/functions/logs, Cloudflare Workers/R2/DNS, Resend domain/templates/events.

Status meanings: **PASS** = directly verified; **FIX PROPOSED** = prepared in audit PR but not yet applied/verified; **BLOCKED** = requires an account/dashboard action not available through the connected tools; **OPEN** = needs further testing or a safe decision.

## Priority 0: production failures
- [ ] **BLOCKED: Fix Resend contact sync authentication.** Supabase logs show 28 `Resend contact lookup failed. 401` messages and 28 HTTP 502 responses from `/functions/v1/resend-contact-sync`. The function expects a separate `RESEND_CONTACTS_API_KEY` with Contacts API permissions. In Supabase Dashboard → Project Settings → Edge Functions → Secrets, add/update `RESEND_CONTACTS_API_KEY` using a Resend key with Contacts permissions. Keep `RESEND_API_KEY` send-only and server-side. Do not put either secret in the browser or database. Then test sync once with a test account and confirm the logs show success.
- [ ] **BLOCKED: Enable leaked-password protection.** Supabase security advisor says Auth leaked-password protection is disabled. Enable it in Authentication → Security and test signup/password change. Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- [ ] **OPEN: End-to-end UI test for every action and link.** Current CI runs static regression checks, build, Worker syntax/SEO tests, production dependency audit, CodeQL, and an analytics endpoint smoke test. It does not perform a complete browser click-through for every public/admin button or validate all generated destinations. Add/run a browser test suite for signup/sign-in/reset, profile changes, comments/reactions/reports, More/notifications, chapter reader, membership/payment, admin tabs/actions, Email Studio, data export/deletion, and external links.

## Supabase / database
- [x] **PASS: RLS enabled on all public tables checked.** The direct audit query found no public base tables with RLS disabled.
- [x] **PASS: `record_feature_login()` grant verified.** Execute permission exists for `authenticated`, `postgres`, and `service_role`; it was not granted to `anon`. Keep the user-facing signed-in feature intact.
- [x] **PASS: Restricted tables remain fail-closed.** `email_marketing_preferences` and `notification_event_dispatches` have RLS enabled without client policies. Leave them restricted unless a deliberate authenticated client use case is proven.
- [ ] **FIX PROPOSED: Index both `email_campaigns` foreign keys.** Advisor found missing covering indexes for `created_by` and `template_id`. The audit PR adds indexes without changing data.
- [ ] **FIX PROPOSED: Remove three duplicate/overlapping SELECT policies.** `dpdp_consent_records` and `dpdp_nominations` had logically identical reader-owned SELECT policies. `dpdp_deletion_requests` had an owner-only SELECT policy overlapping a second policy that already allows the owner and admins. The proposed migration retains the broader existing owner/admin policy.
- [ ] **FIX PROPOSED: Optimize six RLS auth checks.** `notification_preferences` (SELECT/INSERT/UPDATE), `email_delivery_events` (SELECT), `email_templates` (ALL), and `email_campaigns` (SELECT) used direct auth checks which the advisor reports can be wrapped in a scalar SELECT. The proposed migration preserves policy intent and roles.
- [ ] **OPEN: Re-run Supabase security/performance advisors after migration.** Confirm the duplicate-policy, RLS-initplan and foreign-key-index findings clear. Do not delete other unused indexes solely because the advisor reports no usage; current advisor lists 37 such indexes and they need query/traffic review.
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
- [ ] **OPEN: Observe Worker errors/latency.** Worker Logpush is disabled on the inspected scripts. Consider enabling appropriate, privacy-aware logs or rely on bounded live smoke tests.
- [ ] **OPEN: Review transport-hardening workflow step.** The GitHub workflow marks the HTTPS/TLS/security-header change `continue-on-error: true`; investigate whether it is succeeding and avoid silently treating failure as a hardening success.
- [ ] **OPEN: Check origin routing and DNS health from external network.** DNS records and Cloudflare custom-domain settings are configured, but a complete external browser/HTTP crawl could not be performed during this audit.

## GitHub / CI / code
- [x] **PASS: Current main build.** Main head at audit time: `5ce2917c123e243a941d3c0995e952ec833a5444`. Production build passed: https://github.com/rohit42i/Atmarekha4/actions/runs/39799968497
- [x] **PASS: Current CodeQL run.** https://github.com/rohit42i/Atmarekha4/actions/runs/39799968386
- [x] **PASS: Recent stability PR merged.** PR #127 records prior fixes for privacy exports, email studio loading, notification retries, service-key compatibility, payment/webhook handling, avatar fallback and related flows: https://github.com/rohit42i/Atmarekha4/pull/127
- [ ] **FIX PROPOSED: Review this audit's migration PR.** Do not mark database changes complete until CI passes, PR is merged, migration is applied, and advisors are re-run.
- [ ] **OPEN: Triage old open pull requests.** At audit time, the repository has numerous open PRs, including #123 (email library), #117 (signup email notice), #112 (bilingual informational pages), and dependency updates. Compare each diff against current main and test status before merging; do not bulk-merge.
- [ ] **OPEN: Add click-level regression automation.** Existing `npm run check` and Worker SEO tests are useful, but cannot prove every visible button and destination works in a browser.
- [ ] **OPEN: Validate the complete outgoing link inventory.** Check internal routes, external URLs, missing assets, CTA buttons with no action, malformed anchors, routes hidden by auth, and redirect/status behavior. Record each URL and result in CI.
- [ ] **OPEN: Review full dependency audit.** Production dependency audit is a build gate. The complete development-dependency audit is currently `continue-on-error`; review any warnings before raising strictness.

## Manual actions needed to finish
1. Add a dedicated Resend Contacts API key as `RESEND_CONTACTS_API_KEY` in Supabase Edge Function secrets; keep the send key separate. Secret changes are not exposed to the connected management API.
2. Enable Supabase leaked-password protection in Auth security settings.
3. Run a controlled real-browser test of the app with one test account, covering links and actions listed above.
4. After the audit PR merges and its migration runs, rerun Supabase advisors and the live view-count test.

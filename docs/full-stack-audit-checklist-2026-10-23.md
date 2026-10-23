# Atma Rekha Cross-Stack Audit Checklist

Audit date: 2026-10-23

This is a point-in-time checklist based on the connected GitHub repository, live Supabase project metadata, Supabase advisories and logs, Resend configuration/templates, Cloudflare API state, and GitHub Actions results. It does not claim every authenticated UI flow was manually clicked in a browser.

## Verified repairs

### Email and Resend

- [x] Confirmed `atmarekha.in` is verified in Resend and sending is enabled.
- [x] Confirmed the delivery-event webhook is enabled for sent, delivered, delayed, bounced, complained and failed events.
- [x] Fixed malformed empty-anchor markup in the published `ch-announcement` template.
- [x] Corrected published chapter-release templates to link to `https://www.atmarekha.in/`, not `/chapter/2`.
- [x] Made the published automated chapter-release subject dynamic and corrected the Chapter 2 title fallback.
- [x] Added RFC 8058 `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers to consent-aware Email Studio and chapter-release messages.
- [x] Deployed `email-unsubscribe` version 7. Normal GET clicks now show a confirmation page without changing preferences; validated one-click POST updates the saved opt-out.
- [x] Deployed `resend-email-studio` version 19 and `send-reader-event-notification` version 18 with one-click headers.
- [x] Deployed `send-email-to-users` version 17 with non-test bulk sends disabled so the legacy endpoint cannot bypass Email Studio's consent and opt-out checks. Test sends remain available.
- [x] Confirmed `resend-contact-sync` and `resend-contact-backfill` now use Supabase consent/preferences as the source of truth, with no Resend Contacts API key required.
- [x] Disabled the duplicate Resend chapter-release automation because the app's publishing handler already performs consent-aware sends and the template was not safely wired to the publishing event.
- [x] Removed the standalone Gmail SMTP chapter sender and its manual recipient-list workflow from `main`.
- [x] Fixed chapter release subjects to use `Chapter N is now out!` and fixed the notification dispatch status update to use its claimed dispatch ID instead of an undefined variable; deployed `send-reader-event-notification` version 18.
- [x] Hardened `engagement.js` viewer-key creation so restricted browser storage cannot throw before Cloudflare view tracking or the database fallback is attempted. Added a regression test and merged PR #153.
- [x] Confirmed recent Resend delivery records included delivered messages and the webhook recorded sent/delivered events.

### Cloudflare and live site

- [x] Raised `cdn.atmarekha.in` R2 custom-domain minimum TLS from 1.0 to 1.2.
- [x] Rechecked the R2 domain is enabled with ownership active and SSL active.
- [x] Confirmed the main Cloudflare zone has Always Use HTTPS enabled, minimum TLS 1.2 and Automatic HTTPS Rewrites enabled.
- [x] Confirmed the Worker supplies the HSTS header; zone-level HSTS remains disabled to avoid competing header ownership.
- [x] The pre-dependency-refresh production run passed the production dependency audit, static checks, production build, Worker deployments, live chapter-view endpoint check, and live routes/assets/security-header smoke test.

### GitHub and application dependencies

- [x] Merged PR #145: https://github.com/rohit42i/Atmarekha4/pull/145
- [x] Updated Vite within the existing major line to 6.4.5.
- [x] Updated all locked copies of `postcss-selector-parser` to 6.1.5 using a compatible override.
- [x] Latest main build after the dependency refresh passed `npm audit --omit=dev --audit-level=high` with zero production vulnerabilities. GitHub Actions run #39918686143 also passed the production build, static checks, Worker deployment, chapter-view endpoint smoke test, and live routes/assets/security-header smoke test.
- [x] Confirmed this repository is a React/Vite application using Supabase and Cloudflare Workers; there are no `.php` source files in the repository tree. PHP runtime patching must be done on any separate PHP hosting account, if one exists.

### Supabase review

- [x] Confirmed the production Supabase project is ACTIVE_HEALTHY.
- [x] Reviewed the RLS warnings for `email_marketing_preferences` and `notification_event_dispatches`. Both tables have RLS enabled and no end-user policies; their use is service-role-only. Do not add public policies merely to silence the advisor.
- [x] Reviewed the `record_feature_login()` SECURITY DEFINER advisory. The RPC is required by the reader feature-unlock flow, uses the authenticated user identity, and its execute grant is restricted to authenticated/service roles; anon execute is revoked. Logs showed permission-denied errors before the grant migration and successful 200 responses after it.

## Outstanding items requiring configuration or further end-to-end testing

- [x] **Analytics Worker code-path test:** merged PR #156 adds an in-memory R2 test that confirms invalid IDs are rejected, a valid view event persists, repeated viewer/chapter/day requests are idempotent, and GET `/v1/views` reports that event. The main CI build passed this test alongside the live endpoint smoke test.
- [ ] **Chapter-view production traffic:** R2 still showed only legacy-imported events through October 21, with no event objects on October 22–23 during the audit. The Worker code path is now unit-tested, but there is no observed real reader event in that window. Keep the Supabase fallback and public insert policy intact until a normal published-chapter view is observed reaching R2 and appearing in both public and admin counts; then migrate to Worker-only writes in a coordinated change.

- [ ] **Automatic Cloudflare zone-setting enforcement:** the live settings have been corrected, but GitHub Actions reports `CLOUDFLARE_ZONE_SETTINGS_TOKEN` is missing. Add a repository Actions secret using a zone-scoped Cloudflare token with Zone Settings Read/Edit, so CI can keep verifying the settings automatically.
- [ ] **Remaining development-only advisory:** `braces@3.0.3` is pulled transitively through development tooling. Upstream currently lists no patched release for GHSA-vfj7-8cjw-p6xm. Do not force Tailwind CSS 4 merely to suppress it. Recheck when upstream ships a fix or a safe replacement is identified. npm audit also continues to flag the pinned `postcss-selector-parser@6.1.5` because its advisory range says `<7.1.6`; upstream released 6.1.5 as a security backport for the maintained 6.x line. The production-only audit passed with zero vulnerabilities on the latest build.
- [ ] **Live inbox unsubscribe test:** the one-click unsubscribe handler and its saved preference logic are deployed, but a real inbox test confirming Gmail's one-click POST and the manual confirmation page has not been performed through this interface.
- [ ] **Authenticated UI walkthrough:** the public-site smoke test covers 11 fixed routes, 12 same-origin sitemap URLs and 7 shell assets. It is not a browser click-through of every signed-in, payment, membership, admin and mobile interaction. Those flows still need a complete real-browser pass.

## Critical PHP advisory (separate hosts only)

CERT-In reported critical PHP remote-code-execution vulnerabilities CVE-2026-109618 and CVE-2026-109619 on 2026-10-21. Fixed upstream versions are PHP 8.5.12, 8.4.27, 8.3.36 and 8.2.35. No PHP runtime was found in this repository, so this site cannot be patched for PHP from this codebase. If any separate cPanel/WordPress/PHP host belongs to this project, verify its actual PHP runtime and update it through that host's supported package manager immediately.

References:
- CERT-In advisory: https://www.cert-in.org.in/s2cMainServlet?VLCODE=CIVN-2026-0510&pageid=PUBVLNOTES01
- Official PHP security archive: https://www.php.net/archive/2026.php#2026-10-21-5
- Vite advisory: https://github.com/vitejs/vite/security/advisories/GHSA-9jrq-w75r-8gcw
- PostCSS selector parser advisory: https://github.com/advisories/GHSA-rj75-hqrm-r3gf
- Unpatched braces advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

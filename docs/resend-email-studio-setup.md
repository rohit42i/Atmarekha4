# Resend Email Studio setup

The Admin Panel's **Email Campaigns** tab now hosts the Email Studio. The sending Edge Function calls the Resend API directly; it does not send email through Supabase Auth or Supabase SMTP. Supabase stores editable templates, campaign history, and opt-out preferences only.

## Required Supabase Edge Function secrets

In Supabase Dashboard → Project Settings → Edge Functions → Secrets, configure:

- `RESEND_API_KEY`: a restricted Resend API key with permission to send emails. Keep this key send-only.
- `RESEND_FROM_EMAIL`: a sender address on a domain verified in Resend, e.g. `Atma Rekha <no-reply@atmarekha.in>`.
- `RESEND_WEBHOOK_SECRET`: the signing secret for the Resend delivery webhook.

Do not put these values in React, Vite environment variables, GitHub files, or client-accessible tables. The site was verified to have a Resend-verified `atmarekha.in` sending domain. Supabase is the source of truth for reader consent and unsubscribe preferences. No Resend Contacts API key is required for signup, preference changes, or audience checks. Email Studio sends directly through Resend's send-only API key.

## Deployed functions

- `resend-email-studio`: authenticated admin-only template saving and sending through `https://api.resend.com/emails`.
- `email-unsubscribe`: token-based one-click marketing opt-out endpoint.
- `resend-email-webhook`: receives signed Resend lifecycle events. Configure `RESEND_WEBHOOK_SECRET` separately and register the endpoint below in Resend.

Webhook URL: `https://pbukwjokgkqacaphlqzm.supabase.co/functions/v1/resend-email-webhook`

Subscribe to `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, and `email.failed`. Copy the signing secret shown by Resend into Supabase as `RESEND_WEBHOOK_SECRET`.

## Studio behavior

- Includes 20 starter templates for welcome, verification, account changes/deletion, security, comments, chapters, membership, payments, announcements, community, feedback, maintenance, and support.
- Supports saving/editing templates, subject/body edits, HTML preview, plain-text fallback, single/multiple selected readers, all confirmed accounts, active members, free readers, and readers who joined in the last 30 days.
- Marketing emails include an unsubscribe link and skip readers marked opted out. Transactional account/security emails are separate.
- Campaign records show the number accepted by Resend and failed API submissions. Provider delivery/bounce status appears after the signed webhook is configured.
- The UI lists the first 1,000 profiles for manual selection. Audience sending is resolved server-side from Auth users and subscription records.
- Verify the sender domain and test with one internal address before sending to a segment or all readers. Large sends are currently sent in sequential batches of 10 with per-recipient API calls; this is intended for the current small audience, not high-volume bulk marketing.

## Manual production verification still required

1. Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` secrets in Supabase. Keep the Resend key send-only. Configure `RESEND_WEBHOOK_SECRET` for the delivery webhook.
2. Configure `RESEND_WEBHOOK_SECRET` and create/verify the Resend webhook.
3. Use **Check email audience** to verify the live Supabase eligibility counts, then send one test email. Verify delivery in Resend and the admin delivery monitor before using a reader-wide campaign. No Resend Contacts API key or mirrored contact list is required.
4. Test a marketing email's unsubscribe link and confirm future marketing sends skip that account.
5. Test member/free/recent segment counts against current production data before any bulk send.

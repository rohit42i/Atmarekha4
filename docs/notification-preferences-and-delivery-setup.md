# Notification and delivery setup

These features are implemented in the application branch, but database migrations and Edge Functions must be deployed before they work on the live site.

## 1. Apply database migrations

Apply the new migrations in timestamp order:

- `20261019120000_reader_notification_preferences.sql`
- `20261019160000_email_delivery_events.sql`
- `20261019161000_notification_event_dispatches.sql`

The notification preferences table is restricted to each reader's own account. Email delivery event rows are readable only by admins and are written by the service role.

## 2. Deploy notification functions

Deploy the updated and new functions to the existing Supabase project:

- `send-chapter-notification-v2`
- `send-reader-event-notification`
- `resend-email-webhook`

Keep the existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` secrets configured. Do not put these values in the repository.

## 3. Configure Resend delivery events

1. Set the Supabase Edge Function secret `RESEND_WEBHOOK_SECRET` to the signing secret generated for the Resend webhook.
2. In Resend, create a webhook targeting the deployed `resend-email-webhook` function URL.
3. Subscribe to the email lifecycle events available in the Resend dashboard, especially sent, delivered, delivery delayed, bounced, complained, and failed.
4. Send a test email and confirm that provider events appear in **Admin → Operations → Email send monitor**.

A successful API response means Resend accepted the send request; it does not prove inbox delivery. The monitor labels provider events separately for that reason.

## 4. Test notification preferences

- Sign in as a reader, open **More & Settings → Notification preferences**, turn one category off, and save.
- Publish a test chapter through Operations, post a community update, send a group-chat message, and reply to a comment.
- Confirm that opted-out categories do not receive the corresponding push alert.
- Check **Admin → Chapter Health Check → Check site links** and **Check chapter images**.
- Test membership access for Free, ₹19 Atma-only, ₹29 Premium Supporter, and ₹49 Super Supporter.

## Important behavior

- Reader preferences apply to signed-in accounts with push subscriptions. Readers who have no saved preference row retain the default enabled behavior.
- Chapter release dates are scheduling reminders; this UI does not auto-publish chapters at the chosen time.
- The site link checker checks same-origin URLs discovered from the sitemap and the current document. Browser checks cannot reliably validate third-party links that block cross-origin requests.

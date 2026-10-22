# Email operations

## Sender
- From: `Atma Rekha <no-reply@atmarekha.in>`
- Reply-to: `atmarekhasupport@gmail.com`
- General announcement URL: `https://www.atmarekha.in/`

## Subscription rules
- Follow the current signup disclosure and recorded account preferences.
- Never override an explicit unsubscribe during contact sync, import, or backfill.
- Resend-side unsubscribe events should be reflected in the website preference table.
- A reader who previously unsubscribed must deliberately re-enable updates before being resubscribed.
- Chapter announcements and important updates are separate from promotional marketing. Keep promotional email consent separately gated.
- Do not send to unverified accounts.

## Sending checklist
1. Verify the subject, chapter number, and message content.
2. Verify the chapter is published.
3. Use the homepage URL unless a chapter-specific URL is explicitly requested and verified.
4. Check recipient counts and exclusions before sending.
5. Verify delivery events after sending.
6. Confirm each recipient's unsubscribe link is generated at send time and works.
7. Never commit secrets, contact exports, real unsubscribe tokens, or delivery logs.

## Secrets
Configure `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` only in Supabase Edge Function secrets. Never store their values in this repository.

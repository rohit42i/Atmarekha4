# Email operations

## Sender
- From: `Atma Rekha <no-reply@atmarekha.in>`
- Reply-to: `atmarekhasupport@gmail.com`
- General announcement URL: `https://www.atmarekha.in/`

## Subscription rules
- Follow the current signup disclosure and recorded account preferences.
- Never override an explicit unsubscribe during contact sync, import, or backfill.
- Keep chapter announcements and important Atma Rekha reader updates separate from promotional marketing.
- Do not send chapter updates to unverified accounts or accounts without recorded update consent.
- A reader who previously unsubscribed must deliberately re-enable updates before being resubscribed.
- Do not rely on Resend contact sync as the source of truth for consent; the website preference and consent records control eligibility.

## Sending checklist
1. Verify the subject, chapter number, and message content.
2. Verify the chapter is published.
3. Use the homepage URL unless a chapter-specific URL is explicitly requested and verified.
4. Check eligible-recipient counts and opt-out exclusions before sending.
5. Verify delivery events after sending.
6. Confirm each recipient's unsubscribe link is generated at send time and works.
7. Never commit secrets, contact exports, real unsubscribe tokens, or delivery logs.

## Secrets
Configure `RESEND_API_KEY` (send-only), `RESEND_FROM_EMAIL`, and `RESEND_WEBHOOK_SECRET` in Supabase Edge Function secrets. Supabase consent and preferences are the source of truth; no Resend Contacts API key is needed for Email Studio's direct-send flow. Never put secrets in this repository or browser code. 
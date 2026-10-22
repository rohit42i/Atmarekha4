# Atma Rekha email library

This folder keeps reusable email copy and operational guidance in one place. It must never contain recipient exports, private user data, unsubscribe tokens, or API keys.

## Structure
- `templates/`: reusable email copy.
- `campaigns/`: finalized copy for a specific chapter or release.
- `operations.md`: sender, preference, testing, and delivery rules.

## Sending implementation
The live sending code is maintained under `supabase/functions/`:
- `resend-email-studio/`: admin email studio, audience selection, sending, and delivery logging.
- `resend-contact-sync/`: keeps a signed-in user's contact aligned with preferences.
- `resend-contact-backfill/`: admin-only contact sync.
- `update-chapter-email-preference/`: notification preference toggle.
- `email-unsubscribe/` and `resend-email-webhook/`: unsubscribe and provider event handling.

Update copy here, then apply it to the appropriate admin template. Never hardcode recipients into templates.

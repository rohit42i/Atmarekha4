# Supabase Edge Function Porting Plan

**Updated:** 16 October 2026  
**Source:** Supabase project `pbukwjokgkqacaphlqzm`  
**Target:** Zoho Catalyst project `81164000000013050`, Development only

This inventory was read from the live Supabase Edge Functions API. All 16 listed functions were reported ACTIVE. Catalyst Development currently reports zero functions. No production function has been changed.

## Porting inventory

| Function | Source version | Supabase verify_jwt | Priority | Required replacement work |
|---|---:|---|---|---|
| `secure-password-login` | 5 | false | Critical | Re-design against Catalyst Identity; do not reproduce Supabase Auth internals or bypass identity checks. |
| `delete-account` | 18 | true | Critical | Verify caller identity, revoke sessions, delete/anonymize linked records, handle privacy-retention requirements. |
| `create-razorpay-order` | 19 | false | Critical | Authenticate payer, validate server-calculated amount, use server-only Razorpay credentials, persist idempotency key. |
| `verify-razorpay-payment` | 19 | false | Critical | Verify provider signature server-side, confirm order/payment state with Razorpay, idempotent entitlement update. |
| `create-razorpay-subscription` | 34 | false | Critical | Server-side plan/price mapping, identity/ownership checks, duplicate-subscription protection. |
| `verify-razorpay-subscription` | 21 | false | Critical | Verify provider state/signature and reconcile subscription/entitlement records idempotently. |
| `razorpay-subscription-webhook` | 25 | false | Critical | Verify raw-body webhook signature, deduplicate event IDs, safely process retries and out-of-order events. |
| `cancel-razorpay-subscription` | 10 | false | High | Verify ownership, provider-side cancellation, local status reconciliation and retry safety. |
| `get-admin-user-stats` | 10 | true | High | Enforce admin authorization server-side; avoid exposing user-level details to readers. |
| `get-admin-console-data` | 3 | true | High | Enforce admin role and field-level access; preserve dashboard response contract. |
| `dpdp-data-rights` | 5 | true | Critical | Authenticated requester validation, export/deletion workflows, audit trail and retention rules. |
| `register-push-subscription` | 4 | false | High | Authenticate and bind subscription to caller; validate endpoint and safely store token material. |
| `send-chapter-notification-v2` | 26 | true | High | Admin/service authorization, Web Push signing, recipient selection, deduplication and delivery failures. |
| `send-chapter-notification` | 18 | true | Review | Confirm whether this legacy path is still used; port only if referenced by current clients or jobs. |
| `send-email-to-users` | 8 | true | High | Strict admin authorization, recipient limits, provider credentials in secret config, abuse protection. |
| `submit-feedback` | 2 | false | Medium | Rate-limit, validate payload, prevent spoofing and preserve moderation workflow. |

> `verify_jwt=false` is not proof that an endpoint is intentionally public. It means the function cannot rely on the platform JWT gate alone; inspect its application-level authentication and authorization before porting.

## Implementation rules

1. Preserve the current production Supabase functions until the Catalyst replacements pass tests.
2. Use Catalyst Node.js functions/AppSail as appropriate; replace Deno APIs and `@supabase/supabase-js` calls rather than attempting to run the old files unchanged.
3. Keep Razorpay keys, webhook secrets, email provider credentials, and Web Push private keys in server-side secret configuration only. Never add them to Git or browser code.
4. Use Catalyst Identity and the application's own server-side authorization checks; never trust role values supplied by the browser.
5. Use stable event IDs/idempotency keys for payment and webhook processing.
6. Build contract tests from the current frontend request/response shapes before replacing any route.
7. Deploy only to Catalyst Development first. Test unauthenticated, wrong-user, non-admin, retry, duplicate-event, malformed-input, and provider-failure cases.
8. Route production traffic only after all 16 functions have an explicit ported / intentionally retired decision and rollback is tested.

## Current blocker

The connected Catalyst tooling can list/read/execute existing functions and update some function settings, but it did not expose a function-source creation/deployment operation in the available API. The Catalyst console/CLI is required to create and deploy the new function source. Stratus first-use initialization is also required before the storage migration can proceed.
